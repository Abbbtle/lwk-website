import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as destinations from 'aws-cdk-lib/aws-lambda-destinations';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as actions from 'aws-cdk-lib/aws-ses-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import { checkedForwarderName, forwardedAddresses } from '../lambda/mail-forwarder/forwarding';
import { forwarderEnvironment } from '../lambda/mail-forwarder/settings';

export type MailStackProps = cdk.StackProps & {
  /** The shared zone (lwk-domain); its apex is the mail domain. */
  hostedZone: route53.IPublicHostedZone;
  /**
   * Local parts of the mailboxes SES receives, for example ["support"] for support@<domain>:
   * distinct, lowercase and without @ (checked when synthesizing).
   */
  forwardedLocalParts: readonly [string, ...string[]];
  /**
   * Parameter Store name holding the address that mail is forwarded to, which is also where
   * forwarding failures are reported. It is created outside the repository ("Mail for the domain"
   * in the root README) and resolved when the stack deploys, so the address appears in neither
   * the code nor the template, and a deploy fails if the parameter is missing.
   */
  forwardToParameterName: string;
  /**
   * Shown as "<original sender> via <forwarderName>" in the From name of forwarded mail: printable
   * ASCII without quotes or backslashes (checked when synthesizing).
   */
  forwarderName: string;
};

const MESSAGE_PREFIX = 'inbound/';
const MESSAGE_RETENTION = cdk.Duration.days(30);

/**
 * Mail for the domain. Amazon SES receives mail for the forwarded mailboxes (for example support@),
 * stores each message in a private bucket for 30 days and forwards it from the same mailbox, with
 * Reply-To set to the original sender. A message that still fails after Lambda's retries is
 * reported by email to the forward-to address and stays in the bucket. The domain is also a
 * verified SES identity (DKIM, a custom MAIL FROM domain and DMARC in monitoring mode), which
 * sending from the domain needs later. While SES is in its sandbox, the forward-to address must
 * itself be verified in SES. Shared by all stages; deployed in the workload region, where SES
 * receives the mail.
 */
export class MailStack extends cdk.Stack {
  /** The domain as an SES sender (DKIM and MAIL FROM set up), for mail sent from it later. */
  public readonly sendingIdentity: ses.IEmailIdentity;

  constructor(scope: Construct, id: string, props: MailStackProps) {
    super(scope, id, props);
    const zone = props.hostedZone;
    const domain = zone.zoneName;
    const addresses = forwardedAddresses(props.forwardedLocalParts, domain);
    const forwarderName = checkedForwarderName(props.forwarderName);
    const forwardTo = ssm.StringParameter.valueForStringParameter(
      this,
      props.forwardToParameterName,
    );

    // ---- The domain as a sender: SES creates the DKIM and MAIL FROM records in the zone ----
    this.sendingIdentity = new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.publicHostedZone(zone),
      mailFromDomain: `mail.${domain}`,
    });
    // Monitoring only for now: receivers check the domain's mail but are not asked to act on it.
    new route53.TxtRecord(this, 'Dmarc', {
      zone,
      recordName: `_dmarc.${domain}`,
      values: ['v=DMARC1; p=none'],
    });
    // Mail for the domain is delivered to SES in this region.
    new route53.MxRecord(this, 'InboundMx', {
      zone,
      recordName: domain,
      values: [{ priority: 10, hostName: `inbound-smtp.${this.region}.amazonaws.com` }],
    });

    // ---- Received messages, kept long enough to recover anything skipped or not forwarded ----
    const messages = new s3.Bucket(this, 'MessageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ id: 'expire-received-mail', expiration: MESSAGE_RETENTION }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---- Failures: SES invokes the forwarder asynchronously, so Lambda retries a failed message
    // twice and then hands the event to this topic, which emails the forward-to address ----
    const failures = new sns.Topic(this, 'ForwardingFailures', {
      displayName: 'LWK mail forwarding failures',
      enforceSSL: true,
    });
    failures.addSubscription(new subscriptions.EmailSubscription(forwardTo));

    // The AWS SDK comes with the Lambda runtime, so it is left out of the bundle (the default).
    const forwarder = new nodejs.NodejsFunction(this, 'Forwarder', {
      description: `LWK - forwards mail for ${addresses.join(', ')}`,
      entry: path.join(__dirname, '..', 'lambda', 'mail-forwarder', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, 'ForwarderLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: forwarderEnvironment({
        messageBucket: messages.bucketName,
        messagePrefix: MESSAGE_PREFIX,
        forwardTo,
        forwarderName,
        forwardedAddresses: addresses,
      }),
      onFailure: new destinations.SnsDestination(failures),
    });
    messages.grantRead(forwarder, `${MESSAGE_PREFIX}*`);
    forwarder.addToRolePolicy(
      new iam.PolicyStatement({
        // Only from the forwarded mailboxes. In the sandbox SES also checks the destination's
        // identity, hence every identity in this account and region.
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
        conditions: { StringEquals: { 'ses:FromAddress': addresses } },
      }),
    );

    // ---- Receiving: store first, then forward (actions run in order) ----
    const ruleSet = new ses.ReceiptRuleSet(this, 'RuleSet', { receiptRuleSetName: 'lwk-mail' });
    ruleSet.addRule('Forward', {
      recipients: addresses,
      // Spam and virus verdicts, which the forwarder uses to skip messages.
      scanEnabled: true,
      actions: [
        new actions.S3({ bucket: messages, objectKeyPrefix: MESSAGE_PREFIX }),
        new actions.Lambda({
          function: forwarder,
          invocationType: actions.LambdaInvocationType.EVENT,
        }),
      ],
    });
    // CloudFormation cannot make a rule set the active one (SES has one per region), so an SES
    // call does it, and switches it off again if the stack is deleted.
    new cr.AwsCustomResource(this, 'ActiveRuleSet', {
      onCreate: activate(ruleSet.receiptRuleSetName),
      onUpdate: activate(ruleSet.receiptRuleSetName),
      onDelete: { service: 'SES', action: 'setActiveReceiptRuleSet', parameters: {} },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({ actions: ['ses:SetActiveReceiptRuleSet'], resources: ['*'] }),
      ]),
      installLatestAwsSdk: false,
    });

    new cdk.CfnOutput(this, 'ForwardedAddresses', { value: addresses.join(', ') });
    new cdk.CfnOutput(this, 'MessageBucketName', { value: messages.bucketName });
  }
}

function activate(ruleSetName: string): cr.AwsSdkCall {
  return {
    service: 'SES',
    action: 'setActiveReceiptRuleSet',
    parameters: { RuleSetName: ruleSetName },
    physicalResourceId: cr.PhysicalResourceId.of(ruleSetName),
  };
}

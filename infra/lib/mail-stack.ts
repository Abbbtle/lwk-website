import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as actions from 'aws-cdk-lib/aws-ses-actions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

export type MailStackProps = cdk.StackProps & {
  /** The shared zone (lwk-domain); its apex is the mail domain. */
  hostedZone: route53.IPublicHostedZone;
  /** Local parts that receive mail, for example ["support"] for support@<domain>. */
  forwardedMailboxes: readonly string[];
  /**
   * Parameter Store name holding the address that mail is forwarded to. It is created outside the
   * repository (see the README) and resolved when the stack deploys, so the address appears in
   * neither the code nor the template, and a deploy fails if the parameter is missing.
   */
  forwardToParameterName: string;
  /** Shown after the original sender in the From name of forwarded mail. */
  senderName: string;
};

const MESSAGE_PREFIX = 'inbound/';
const MESSAGE_RETENTION = cdk.Duration.days(30);

/**
 * Mail for the domain. Amazon SES receives mail for the forwarded mailboxes (for example support@),
 * stores each message in a private bucket for 30 days and forwards it from the same mailbox, with
 * Reply-To set to the original sender. The domain is also a verified SES identity (DKIM, a custom
 * MAIL FROM domain and DMARC in monitoring mode), which sending from the domain needs later. While
 * SES is in its sandbox, the forwarding address must itself be verified in SES. Shared by all
 * stages; deployed in the workload region, where SES receives the mail.
 */
export class MailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MailStackProps) {
    super(scope, id, props);
    const zone = props.hostedZone;
    const domain = zone.zoneName;
    const mailboxes = props.forwardedMailboxes.map((name) => `${name}@${domain}`);

    // ---- The domain as a sender: SES creates the DKIM and MAIL FROM records in the zone ----
    new ses.EmailIdentity(this, 'DomainIdentity', {
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

    const forwarder = new nodejs.NodejsFunction(this, 'Forwarder', {
      description: `LWK - forwards mail for ${mailboxes.join(', ')}`,
      entry: path.join(__dirname, '..', 'lambda', 'mail-forwarder.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, 'ForwarderLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        MESSAGE_BUCKET: messages.bucketName,
        MESSAGE_PREFIX,
        FORWARDED_ADDRESSES: mailboxes.join(','),
        FORWARD_TO: ssm.StringParameter.valueForStringParameter(this, props.forwardToParameterName),
        SENDER_NAME: props.senderName,
      },
      // The AWS SDK comes with the Lambda runtime, so it is left out of the bundle.
      bundling: { minify: true, target: 'node24' },
    });
    messages.grantRead(forwarder, `${MESSAGE_PREFIX}*`);
    forwarder.addToRolePolicy(
      new iam.PolicyStatement({
        // Only from the forwarded mailboxes. In the sandbox SES also checks the destination's
        // identity, hence every identity in this account and region.
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
        conditions: { StringEquals: { 'ses:FromAddress': mailboxes } },
      }),
    );

    // ---- Receiving: store first, then forward (actions run in order) ----
    const ruleSet = new ses.ReceiptRuleSet(this, 'RuleSet', { receiptRuleSetName: 'lwk-mail' });
    ruleSet.addRule('Forward', {
      recipients: mailboxes,
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

    new cdk.CfnOutput(this, 'Mailboxes', { value: mailboxes.join(', ') });
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

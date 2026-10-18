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
import {
  checkedForwarderName,
  forwardedAddresses,
} from '../lambda/mail-forwarder/forwarding-rules';
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

const MESSAGE_KEY_PREFIX = 'inbound/';
const MESSAGE_RETENTION = cdk.Duration.days(30);

/**
 * Mail for the domain. Amazon SES receives mail for the forwarded mailboxes (for example support@),
 * stores each message in a private bucket for 30 days and forwards it from the same mailbox, with
 * Reply-To set to the original sender. The forward-to address is told by email when a message
 * cannot be forwarded (after Lambda's retries) and when a forwarded copy bounces, is reported as
 * spam or is rejected; the message stays in the bucket. The domain is a verified SES identity
 * (DKIM, a custom MAIL FROM domain and DMARC in monitoring mode): forwarded copies are sent from it,
 * and other mail from the domain can be later. While SES is in its sandbox, the forward-to address
 * must itself be verified in SES. Shared by all stages; deployed in the workload region, where SES
 * receives the mail.
 */
export class MailStack extends cdk.Stack {
  /**
   * The domain as an SES sender (DKIM and MAIL FROM). Forwarded copies are sent from it now; other
   * mail from the domain (sign-in emails, notifications) can use it later. Emailed bounce and
   * complaint notices are off for the domain (they would loop through the forwarder), so anything
   * else that sends through this identity must name its own configuration set with bounce and
   * complaint event destinations (see "Mail" in docs/PLAN.md).
   */
  readonly sendingIdentity: ses.IEmailIdentity;

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
      // By default SES emails bounce and complaint notices to the sender, which for forwarded
      // copies is a forwarded mailbox: the notices would be forwarded round in a loop. The
      // configuration set below reports them instead. (SES still emails notices for mail sent
      // without such a configuration set.)
      feedbackForwarding: false,
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

    // ---- Failures, emailed to the forward-to address ----
    const failures = new sns.Topic(this, 'ForwardingFailures', {
      displayName: 'LWK mail forwarding failures',
      enforceSSL: true,
    });
    failures.addSubscription(new subscriptions.EmailSubscription(forwardTo));
    // What happens to a copy after SES accepts it. Suppression is off for these copies, so that one
    // bounce or complaint does not stop every later copy until someone removes the forward-to
    // address from the account's suppression list by hand. In exchange, each bounce and complaint
    // counts toward the account's sending reputation (see "Mail" in docs/PLAN.md).
    const forwardedMail = new ses.ConfigurationSet(this, 'ForwardedMail', {
      disableSuppressionList: true,
    });
    forwardedMail.addEventDestination('Failures', {
      destination: ses.EventDestination.snsTopic(failures),
      events: [
        ses.EmailSendingEvent.BOUNCE,
        ses.EmailSendingEvent.COMPLAINT,
        ses.EmailSendingEvent.REJECT,
      ],
    });

    // The AWS SDK comes with the Lambda runtime, so it is left out of the bundle (the default).
    const forwarder = new nodejs.NodejsFunction(this, 'Forwarder', {
      description: `LWK - forwards mail for ${addresses.join(', ')}`,
      entry: path.join(__dirname, '..', 'lambda', 'mail-forwarder', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      // Room to hold a large message (SES receives up to 40 MB) while it is sent on.
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, 'ForwarderLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: forwarderEnvironment({
        messageBucketName: messages.bucketName,
        messageKeyPrefix: MESSAGE_KEY_PREFIX,
        forwardTo,
        forwarderName,
        forwardedAddresses: addresses,
        configurationSetName: forwardedMail.configurationSetName,
      }),
      // SES invokes the function asynchronously: Lambda retries a failed message twice, then
      // hands the event to the failure topic.
      onFailure: new destinations.SnsDestination(failures),
    });
    messages.grantRead(forwarder, `${MESSAGE_KEY_PREFIX}*`);
    forwarder.addToRolePolicy(
      new iam.PolicyStatement({
        // Only from the forwarded mailboxes, through the configuration set. In the sandbox SES
        // also checks the destination's identity, hence every identity in this account and region.
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [
          this.formatArn({ service: 'ses', resource: 'identity', resourceName: '*' }),
          this.formatArn({
            service: 'ses',
            resource: 'configuration-set',
            resourceName: forwardedMail.configurationSetName,
          }),
        ],
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
        new actions.S3({ bucket: messages, objectKeyPrefix: MESSAGE_KEY_PREFIX }),
        new actions.Lambda({
          function: forwarder,
          invocationType: actions.LambdaInvocationType.EVENT,
        }),
      ],
    });

    // CloudFormation cannot make a rule set the active one (SES has one per region), so an SES
    // call does. There is deliberately no call to switch it off on delete: CloudFormation also
    // deletes this resource when it replaces it (say the construct moves), and receiving would then
    // stop without any error. Deleting the stack therefore needs receiving switched off by hand
    // first, as SES cannot delete the active rule set (see "Mail for the domain" in the README).
    const activation = new cr.AwsCustomResource(this, 'ActiveRuleSet', {
      onCreate: activate(ruleSet.receiptRuleSetName),
      onUpdate: activate(ruleSet.receiptRuleSetName),
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({ actions: ['ses:SetActiveReceiptRuleSet'], resources: ['*'] }),
      ]),
      installLatestAwsSdk: false,
    });
    // Switched on after everything else exists, so a failed first deploy can still roll back.
    for (const other of this.node.children) {
      if (other !== activation) activation.node.addDependency(other);
    }

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

import * as cdk from 'aws-cdk-lib/core';
import type * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import type * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { CanonicalHostRedirect } from './canonical-host-redirect';
import { config, siteUrl, type StageConfig } from './config';
import { DistributionAliasRecords } from './distribution-alias-records';

export type AppStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  /** The shared zone (lwk-domain), where the site's address records go. */
  hostedZone: route53.IHostedZone;
  /** Certificate for the site host name, from the stage's edge stack in us-east-1. */
  certificate: acm.ICertificate;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  database: rds.DatabaseInstance;
  databaseName: string;
  databaseUser: string;
  mediaBucket: s3.IBucket;
  userPool: cognito.IUserPool;
  webClient: cognito.IUserPoolClient;
  /** Cognito hosted sign-in domain, from the auth stack (COGNITO_DOMAIN). */
  authDomainUrl: string;
};

/**
 * The Next.js server on one EC2 instance behind CloudFront, served at the stage's site host name.
 * Releases are built in CI, uploaded to the artifacts bucket and activated with SSM Run Command
 * (deploy/instance/activate.sh).
 */
export class AppStack extends cdk.Stack {
  readonly instance: ec2.Instance;
  readonly artifactsBucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly logGroup: logs.LogGroup;
  readonly appUrl: string;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { stage } = props.stageConfig;
    const paramPrefix = `/lwk/${stage}/web`;

    this.artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `lwk-${stage}-artifacts-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ id: 'expire-old-releases', expiration: cdk.Duration.days(30) }],
      // Only rebuildable release bundles live here.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const logGroup = (this.logGroup = new logs.LogGroup(this, 'WebLogs', {
      logGroupName: `/lwk/${stage}/web`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }));

    // ---- Instance role: least privilege for what the app and deploy script do ----
    const role = new iam.Role(this, 'WebRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: `LWK ${stage} web server`,
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    props.database.secret!.grantRead(role);
    props.mediaBucket.grantReadWrite(role);
    props.mediaBucket.grantDelete(role);
    this.artifactsBucket.grantRead(role);
    logGroup.grantWrite(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        // Role management and account administration from the admin area. Self-service calls
        // (profile, two-step status, sign out, delete account) use the user's own access token.
        actions: [
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsersInGroup',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminUserGlobalSignOut',
          'cognito-idp:AdminSetUserMFAPreference',
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    // Claude on Amazon Bedrock through global cross-Region inference profiles: the profile in
    // this Region, the model in this Region, and the Region-less model ARN used for routing.
    // (Converse needs InvokeModel; ConverseStream needs InvokeModelWithResponseStream.)
    const { ai } = props.stageConfig;
    for (const profileId of new Set([ai.assistantModel, ai.writerModel])) {
      const modelName = profileId.replace(/^global\./, '');
      const profileArn = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${profileId}`;
      const actions = ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'];
      role.addToPolicy(
        new iam.PolicyStatement({
          actions,
          resources: [profileArn],
          conditions: { StringEquals: { 'aws:RequestedRegion': this.region } },
        }),
      );
      role.addToPolicy(
        new iam.PolicyStatement({
          actions,
          resources: [`arn:aws:bedrock:${this.region}::foundation-model/${modelName}`],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': this.region,
              'bedrock:InferenceProfileArn': profileArn,
            },
          },
        }),
      );
      role.addToPolicy(
        new iam.PolicyStatement({
          actions,
          resources: [`arn:aws:bedrock:::foundation-model/${modelName}`],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': 'unspecified',
              'bedrock:InferenceProfileArn': profileArn,
            },
          },
        }),
      );
    }

    // CloudFront sends this value in a header with every request; the app refuses requests
    // without it, so only our distribution can reach the server (see src/server/security).
    // Generated by Secrets Manager: it never appears in code or in the CloudFormation template.
    const originSecret = new secretsmanager.Secret(this, 'OriginSecret', {
      secretName: `lwk/${stage}/origin-verify`,
      description: `LWK ${stage} - header value CloudFront adds to requests to the web server`,
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    originSecret.grantRead(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        // The request ARN includes the trailing slash of the path (/lwk/<stage>/web/).
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${paramPrefix}`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter${paramPrefix}/*`,
        ],
      }),
    );

    // ---- Instance ----
    const userData = ec2.UserData.forLinux();
    userData.addCommands(...bootstrapCommands(stage, logGroup.logGroupName));

    this.instance = new ec2.Instance(this, 'WebServer', {
      instanceName: `lwk-${stage}-web`,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: props.securityGroup,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.genericLinux({ [config.region]: config.webServerAmi }),
      role,
      userData,
      userDataCausesReplacement: true,
      requireImdsv2: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    cdk.Validations.of(this.instance).acknowledge({
      id: 'CloudFormation-Validate::W9010',
      reason:
        'The AMI is pinned on purpose (config.webServerAmi) so new images never replace the server.',
    });

    // A fixed address, so the CloudFront origin survives instance replacement.
    const eip = new ec2.CfnEIP(this, 'WebAddress', {
      tags: [{ key: 'Name', value: `lwk-${stage}-web` }],
    });
    new ec2.CfnEIPAssociation(this, 'WebAddressAssociation', {
      allocationId: eip.attrAllocationId,
      instanceId: this.instance.instanceId,
    });
    const originDomain = cdk.Fn.join('', [
      'ec2-',
      cdk.Fn.join('-', cdk.Fn.split('.', eip.ref)),
      `.${this.region}.compute.amazonaws.com`,
    ]);

    // ---- CloudFront ----
    const { siteHostName, searchIndexing } = props.stageConfig;
    // HTTP to the origin: the instance holds no public TLS certificate of its own. Only
    // CloudFront IPs may connect (security group). See docs/PLAN.md.
    const origin = new origins.HttpOrigin(originDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 3000,
      readTimeout: cdk.Duration.seconds(30),
      // Resolved by CloudFormation at deploy time (a dynamic reference, not the value).
      customHeaders: { 'X-Origin-Verify': originSecret.secretValue.unsafeUnwrap() },
    });
    // Requests for any other host name (such as the distribution's own address, used before the
    // domain) move to the site's address with their path and query string.
    const redirect = new CanonicalHostRedirect(this, 'CanonicalHost', {
      canonicalHostName: siteHostName,
      comment: `LWK ${stage} - redirects other host names to ${siteHostName}`,
    });
    // Keeps every stage except production out of search results. A response header rather than
    // robots.txt: crawlers have to fetch a page to learn that it must not be indexed.
    const responseHeadersPolicy = searchIndexing
      ? undefined
      : new cloudfront.ResponseHeadersPolicy(this, 'NoIndex', {
          comment: `LWK ${stage} - asks search engines not to index this stage`,
          customHeadersBehavior: {
            customHeaders: [{ header: 'X-Robots-Tag', value: 'noindex, nofollow', override: true }],
          },
        });
    // Every cache behavior is built here, so none can miss HTTPS, the redirect or the noindex
    // header; callers cannot pass those settings, so changing the rule means changing this.
    const siteBehavior = (
      behavior: Omit<
        cloudfront.BehaviorOptions,
        'viewerProtocolPolicy' | 'functionAssociations' | 'responseHeadersPolicy'
      >,
    ): cloudfront.BehaviorOptions => ({
      ...behavior,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      functionAssociations: [redirect.functionAssociation],
      responseHeadersPolicy,
    });
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `LWK ${stage}`,
      domainNames: [siteHostName],
      certificate: props.certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes South Africa
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: siteBehavior({
        origin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // Pages are per user (sign-in cookies): never cached at the edge.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Forward everything, including Host, so Next.js sees the public host name, plus
        // CloudFront's own headers (the viewer's IP address, used for rate limiting).
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
        compress: true,
      }),
      additionalBehaviors: {
        // Hashed build assets are safe to cache for a long time.
        '/_next/static/*': siteBehavior({
          origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        }),
      },
    });
    new DistributionAliasRecords(this, 'SiteAddress', {
      zone: props.hostedZone,
      hostName: siteHostName,
      distribution: this.distribution,
    });
    const appUrl = (this.appUrl = siteUrl(props.stageConfig));

    // ---- Runtime configuration read by activate.sh (names are env var names; no secrets) ----
    const params: Record<string, string> = {
      APP_URL: appUrl,
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.webClient.userPoolClientId,
      COGNITO_DOMAIN: props.authDomainUrl,
      MEDIA_BUCKET: props.mediaBucket.bucketName,
      DATABASE_HOST: props.database.dbInstanceEndpointAddress,
      DATABASE_PORT: props.database.dbInstanceEndpointPort,
      DATABASE_NAME: props.databaseName,
      DATABASE_USER: props.databaseUser,
      DATABASE_SECRET_ARN: props.database.secret!.secretArn,
      ORIGIN_SECRET_ARN: originSecret.secretArn,
      AI_ENABLED: 'true',
      AI_ASSISTANT_MODEL: ai.assistantModel,
      AI_WRITER_MODEL: ai.writerModel,
      AI_MONTHLY_BUDGET_USD: String(ai.monthlyBudgetUsd),
      // Checkout stays off until it is ready. It never decides access: early access ends at
      // EARLY_ACCESS_ENDS_AT, which is created by hand at launch (see docs/PLAN.md, Phase 14).
      PAYMENTS_ENABLED: 'false',
      // Sample courses and articles for UAT; set to "off" for production stages.
      SAMPLE_CONTENT: 'on',
    };
    for (const [name, value] of Object.entries(params)) {
      new ssm.StringParameter(this, `Param${name}`, {
        parameterName: `${paramPrefix}/${name}`,
        stringValue: value,
      });
    }

    new cdk.CfnOutput(this, 'AppUrl', { value: appUrl });
    new cdk.CfnOutput(this, 'InstanceId', { value: this.instance.instanceId });
    new cdk.CfnOutput(this, 'ArtifactsBucketName', { value: this.artifactsBucket.bucketName });
  }
}

/** First-boot setup: Node.js, service user, RDS CA bundle, systemd unit and log shipping. */
function bootstrapCommands(stage: string, logGroupName: string): string[] {
  const node = config.nodeVersion;
  return [
    'set -euxo pipefail',
    'dnf -y install amazon-cloudwatch-agent logrotate',
    // Node.js from nodejs.org, checked against the published SHA-256 sums.
    'cd /tmp',
    `curl -fsSLO https://nodejs.org/dist/v${node}/node-v${node}-linux-arm64.tar.xz`,
    `curl -fsSLO https://nodejs.org/dist/v${node}/SHASUMS256.txt`,
    `grep " node-v${node}-linux-arm64.tar.xz$" SHASUMS256.txt | sha256sum -c -`,
    'mkdir -p /opt/node',
    `tar -xJf node-v${node}-linux-arm64.tar.xz -C /opt/node --strip-components=1`,
    'ln -sf /opt/node/bin/node /usr/local/bin/node',
    'ln -sf /opt/node/bin/npm /usr/local/bin/npm',
    `/opt/node/bin/npm install --global --no-fund --no-audit prisma@${config.prismaVersion}`,
    // Service account and directories.
    'id lwk || useradd --system --home-dir /opt/lwk --shell /sbin/nologin lwk',
    'mkdir -p /opt/lwk/releases /etc/lwk /var/log/lwk',
    'chown lwk:lwk /var/log/lwk',
    // Certificate bundle used to verify the RDS TLS certificate.
    `curl -fsSL https://truststore.pki.rds.amazonaws.com/${config.region}/${config.region}-bundle.pem -o /etc/lwk/rds-ca.pem`,
    'touch /etc/lwk/web.env && chgrp lwk /etc/lwk/web.env && chmod 0640 /etc/lwk/web.env',
    `cat > /etc/systemd/system/lwk-web.service <<'UNIT'
[Unit]
Description=Living With Krishna web app (${stage})
After=network-online.target
Wants=network-online.target
ConditionPathExists=/opt/lwk/current

[Service]
User=lwk
Group=lwk
WorkingDirectory=/opt/lwk/current/app/apps/web
EnvironmentFile=/etc/lwk/web.env
ExecStart=/opt/node/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/lwk/releases
StandardOutput=append:/var/log/lwk/web.log
StandardError=append:/var/log/lwk/web.log

[Install]
WantedBy=multi-user.target
UNIT`,
    'systemctl daemon-reload',
    'systemctl enable lwk-web',
    `cat > /etc/logrotate.d/lwk-web <<'ROTATE'
/var/log/lwk/web.log {
  daily
  rotate 7
  compress
  missingok
  notifempty
  copytruncate
}
ROTATE`,
    // Ship the app log to CloudWatch Logs.
    `cat > /opt/aws/amazon-cloudwatch-agent/etc/lwk.json <<'CWA'
{"logs":{"logs_collected":{"files":{"collect_list":[{"file_path":"/var/log/lwk/web.log","log_group_name":"${logGroupName}","log_stream_name":"{instance_id}"}]}}}}
CWA`,
    '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/lwk.json',
  ];
}

import * as cdk from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { config, type StageConfig } from './config';

export type AppStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  database: rds.DatabaseInstance;
  databaseName: string;
  databaseUser: string;
  mediaBucket: s3.IBucket;
  userPool: cognito.IUserPool;
  webClient: cognito.IUserPoolClient;
  hostedDomainUrl: string;
};

/**
 * The Next.js server on one EC2 instance behind CloudFront. Releases are built in CI, uploaded
 * to the artifacts bucket and activated with SSM Run Command (deploy/instance/activate.sh).
 */
export class AppStack extends cdk.Stack {
  readonly instance: ec2.Instance;
  readonly artifactsBucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

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

    const logGroup = new logs.LogGroup(this, 'WebLogs', {
      logGroupName: `/lwk/${stage}/web`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: [props.userPool.userPoolArn],
      }),
    );
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
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
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
    // HTTP to the origin: without a domain name the instance cannot hold a public TLS
    // certificate. Only CloudFront IPs may connect (security group). See docs/PLAN.md.
    const origin = new origins.HttpOrigin(originDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 3000,
      readTimeout: cdk.Duration.seconds(30),
    });
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `LWK ${stage}`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes South Africa
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // Pages are per user (sign-in cookies): never cached at the edge.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Forward everything, including Host, so Next.js sees the public host name.
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        compress: true,
      },
      additionalBehaviors: {
        // Hashed build assets are safe to cache for a long time.
        '/_next/static/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
    });
    const appUrl = `https://${this.distribution.distributionDomainName}`;

    // ---- Runtime configuration read by activate.sh (names are env var names; no secrets) ----
    const params: Record<string, string> = {
      APP_URL: appUrl,
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.webClient.userPoolClientId,
      COGNITO_DOMAIN: props.hostedDomainUrl,
      MEDIA_BUCKET: props.mediaBucket.bucketName,
      DATABASE_HOST: props.database.dbInstanceEndpointAddress,
      DATABASE_PORT: props.database.dbInstanceEndpointPort,
      DATABASE_NAME: props.databaseName,
      DATABASE_USER: props.databaseUser,
      DATABASE_SECRET_ARN: props.database.secret!.secretArn,
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

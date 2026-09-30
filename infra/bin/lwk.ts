#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AppStack } from '../lib/app-stack';
import { AuthStack } from '../lib/auth-stack';
import { config, stages } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { DeployAccessStack } from '../lib/deploy-access-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { NetworkStack } from '../lib/network-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

// Tag everything so costs can be filtered by project in Cost Explorer.
cdk.Tags.of(app).add('project', config.project);

const env: cdk.Environment = { account: config.account, region: config.region };

// See docs/PLAN.md. The account budget lives in cfn/budget.yaml (stack lwk-guardrails, us-east-1).
for (const stageConfig of Object.values(stages)) {
  const { stage } = stageConfig;
  const common = { env, stageConfig, terminationProtection: true };

  const auth = new AuthStack(app, `lwk-${stage}-auth`, {
    ...common,
    description: `LWK ${stage} - user sign-up and sign-in (Cognito)`,
  });
  const storage = new StorageStack(app, `lwk-${stage}-storage`, {
    ...common,
    description: `LWK ${stage} - course media storage (S3)`,
  });
  const network = new NetworkStack(app, `lwk-${stage}-network`, {
    ...common,
    description: `LWK ${stage} - VPC and security groups`,
  });
  const data = new DataStack(app, `lwk-${stage}-data`, {
    ...common,
    description: `LWK ${stage} - PostgreSQL (RDS)`,
    vpc: network.vpc,
    securityGroup: network.databaseSecurityGroup,
  });
  const web = new AppStack(app, `lwk-${stage}-app`, {
    ...common,
    description: `LWK ${stage} - web server (EC2) and CloudFront`,
    vpc: network.vpc,
    securityGroup: network.webSecurityGroup,
    database: data.database,
    databaseName: data.databaseName,
    databaseUser: data.databaseUser,
    mediaBucket: storage.mediaBucket,
    userPool: auth.userPool,
    webClient: auth.webClient,
    hostedDomainUrl: auth.hostedDomainUrl,
  });
  const deployAccess = new DeployAccessStack(app, `lwk-${stage}-deploy-access`, {
    ...common,
    description: `LWK ${stage} - GitHub Actions deploy role (OIDC)`,
    artifactsBucket: web.artifactsBucket,
    instance: web.instance,
  });

  const monitoring = new MonitoringStack(app, `lwk-${stage}-monitoring`, {
    ...common,
    description: `LWK ${stage} - alarms, uptime check and alerts`,
    instance: web.instance,
    database: data.database,
    logGroup: web.logGroup,
    appUrl: web.appUrl,
    // Personal address: supplied when deploying (ALERT_EMAIL), not stored in the public repo.
    alertEmail: process.env.ALERT_EMAIL,
  });

  for (const stack of [auth, storage, network, data, web, deployAccess, monitoring]) {
    cdk.Tags.of(stack).add('stage', stage);
  }
}

app.synth();

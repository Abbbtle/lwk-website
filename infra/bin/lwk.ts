#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AuthStack } from '../lib/auth-stack';
import { config, stages } from '../lib/config';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

// Tag everything so costs can be filtered by project in Cost Explorer.
cdk.Tags.of(app).add('project', config.project);

const env: cdk.Environment = { account: config.account, region: config.region };

// Stacks are added phase by phase (see docs/PLAN.md):
//   Phase 3: AuthStack (Cognito)
//   Phase 4: StorageStack (media bucket)
//   Phase 6: NetworkStack, DataStack, AppStack, WebStack
// The account budget lives in cfn/budget.yaml (stack lwk-guardrails in us-east-1).
for (const stageConfig of Object.values(stages)) {
  const stack = new AuthStack(app, `lwk-${stageConfig.stage}-auth`, {
    env,
    stageConfig,
    description: `LWK ${stageConfig.stage} - user sign-up and sign-in (Cognito)`,
    terminationProtection: true,
  });
  cdk.Tags.of(stack).add('stage', stageConfig.stage);

  const storage = new StorageStack(app, `lwk-${stageConfig.stage}-storage`, {
    env,
    stageConfig,
    description: `LWK ${stageConfig.stage} - course media storage (S3)`,
    terminationProtection: true,
  });
  cdk.Tags.of(storage).add('stage', stageConfig.stage);
}

app.synth();

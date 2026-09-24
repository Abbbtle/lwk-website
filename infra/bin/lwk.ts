#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { config } from '../lib/config';

const app = new cdk.App();

// Tag everything so costs can be filtered by project in Cost Explorer.
cdk.Tags.of(app).add('project', config.project);

// Stacks are added phase by phase (see docs/PLAN.md):
//   Phase 3: AuthStack (Cognito)
//   Phase 4: StorageStack (media bucket)
//   Phase 6: NetworkStack, DataStack, AppStack, WebStack
// The account budget lives in cfn/budget.yaml (stack lwk-guardrails in us-east-1).
const env: cdk.Environment = { account: config.account, region: config.region };

app.synth();

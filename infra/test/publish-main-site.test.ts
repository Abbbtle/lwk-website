import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { ComingSoonStack } from '../lib/coming-soon-stack';
import { config } from '../lib/config';
import { DomainStack } from '../lib/domain-stack';

// The workflow and the stack are released separately (main publishes the page; CDK deploys the
// stack), so these checks keep the names that join them in step.
const repoRoot = join(__dirname, '..', '..');
const workflow = readFileSync(join(repoRoot, '.github/workflows/publish-main-site.yml'), 'utf8');

function synthesize(): Template {
  // The same feature flags as the real app (weak cross-stack references, among others).
  const { context } = JSON.parse(readFileSync(join(__dirname, '..', 'cdk.json'), 'utf8'));
  const app = new cdk.App({ context });
  const domain = new DomainStack(app, 'lwk-domain', {
    env: { account: config.account, region: config.region },
    apexDomainName: config.apexDomainName,
  });
  const stack = new ComingSoonStack(app, 'lwk-coming-soon', {
    env: { account: config.account, region: config.edgeRegion },
    hostedZone: domain.hostedZone,
    publishBranch: config.productionBranch,
  });
  return Template.fromStack(stack);
}

const template = synthesize();

function publishRole(): { RoleName: string; AssumeRolePolicyDocument: unknown } {
  const roles = Object.values(template.findResources('AWS::IAM::Role')).filter(
    (role) => typeof role.Properties?.RoleName === 'string',
  );
  assert.equal(roles.length, 1, 'expected exactly one named role in lwk-coming-soon');
  return roles[0].Properties;
}

function match(pattern: RegExp, what: string): RegExpMatchArray {
  const found = workflow.match(pattern);
  assert.ok(found, `publish-main-site.yml has no ${what}`);
  return found;
}

describe('publish-main-site.yml and lwk-coming-soon', () => {
  it('assume the same role', () => {
    const [, account, roleName] = match(
      /PUBLISH_ROLE_ARN: arn:aws:iam::(\d+):role\/([\w+=,.@-]+)/,
      'PUBLISH_ROLE_ARN',
    );
    assert.equal(account, config.account);
    assert.equal(roleName, publishRole().RoleName);
  });

  it('agree on the branch, and only that branch of this repository can use the role', () => {
    const [, branches] = match(/push:\s*\n\s*branches: \[([^\]]+)\]/, 'push branches');
    assert.deepEqual(
      branches.split(',').map((branch) => branch.trim()),
      [config.productionBranch],
    );
    const trust = JSON.stringify(publishRole().AssumeRolePolicyDocument);
    assert.ok(
      trust.includes(
        `"token.actions.githubusercontent.com:sub":"repo:${config.githubRepository}:ref:refs/heads/${config.productionBranch}"`,
      ),
      trust,
    );
    assert.ok(trust.includes('"token.actions.githubusercontent.com:aud":"sts.amazonaws.com"'));
  });

  it('agree on every output the workflow reads', () => {
    const read = [...workflow.matchAll(/\$\(output (\w+)\)/g)].map(([, key]) => key);
    assert.deepEqual(read.sort(), ['DistributionId', 'PageBucketName', 'SiteUrl']);
    const outputs = Object.keys(template.toJSON().Outputs ?? {});
    for (const key of read)
      assert.ok(outputs.includes(key), `lwk-coming-soon has no ${key} output`);
  });
});

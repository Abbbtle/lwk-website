import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, it } from 'node:test';
import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { forwardedAddresses } from '../lambda/mail-forwarder/forwarding';
import { readForwarderSettings } from '../lambda/mail-forwarder/settings';
import { config } from '../lib/config';
import { DomainStack } from '../lib/domain-stack';
import { MailStack } from '../lib/mail-stack';

// The receipt rule, the forwarder's settings and the site's contact addresses are configured in
// different places, so these checks keep them in step.
const repoRoot = join(__dirname, '..', '..');
const received = forwardedAddresses(config.mail.forwardedLocalParts, config.apexDomainName);

function synthesize(): Template {
  // The same feature flags as the real app. Only the template is checked, so the forwarder's code
  // is not bundled.
  const { context } = JSON.parse(readFileSync(join(__dirname, '..', 'cdk.json'), 'utf8'));
  const app = new cdk.App({ context: { ...context, 'aws:cdk:bundling-stacks': [] } });
  const env = { account: config.account, region: config.region };
  const domain = new DomainStack(app, 'lwk-domain', {
    env,
    apexDomainName: config.apexDomainName,
  });
  const stack = new MailStack(app, 'lwk-mail', {
    env,
    hostedZone: domain.hostedZone,
    forwardedLocalParts: config.mail.forwardedLocalParts,
    forwardToParameterName: config.mail.forwardToParameterName,
    forwarderName: config.mail.forwarderName,
  });
  return Template.fromStack(stack);
}

const template = synthesize();
const resources = template.toJSON().Resources;

/** The logical ID and properties of the only resource of a type. */
function only(type: string): [string, Record<string, any>] {
  const found = Object.entries(template.findResources(type));
  assert.equal(found.length, 1, `expected one ${type}`);
  const [id, resource] = found[0];
  return [id, resource.Properties];
}

const [, { Rule: rule }] = only('AWS::SES::ReceiptRule');
const [storeAction, forwardAction] = rule.Actions;
const forwarderId: string = forwardAction.LambdaAction.FunctionArn['Fn::GetAtt'][0];
// Values that CloudFormation fills in when deploying are references here; read them as JSON.
const settings = readForwarderSettings(
  Object.fromEntries(
    Object.entries(resources[forwarderId].Properties.Environment.Variables).map(([name, value]) => [
      name,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  ),
);

describe('lwk-mail', () => {
  it("has the domain's mail delivered to SES in its region", () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: `${config.apexDomainName}.`,
      Type: 'MX',
      ResourceRecords: [`10 inbound-smtp.${config.region}.amazonaws.com`],
    });
  });

  it('receives only the forwarded addresses, scanned for spam and viruses', () => {
    assert.equal(rule.Enabled, true);
    assert.deepEqual(rule.Recipients, received);
    assert.equal(rule.ScanEnabled, true);
  });

  it('stores each message where the forwarder then reads it', () => {
    assert.deepEqual(
      rule.Actions.map((action: object) => Object.keys(action)),
      [['S3Action'], ['LambdaAction']],
    );
    assert.equal(forwardAction.LambdaAction.InvocationType, 'Event');
    assert.equal(settings.messageBucket, JSON.stringify(storeAction.S3Action.BucketName));
    assert.equal(settings.messagePrefix, storeAction.S3Action.ObjectKeyPrefix);
  });

  it('gives the forwarder the configured addresses and name', () => {
    assert.deepEqual(settings.forwardedAddresses, received);
    assert.equal(settings.forwarderName, config.mail.forwarderName);
  });

  it('forwards to the address in Parameter Store and reports failures there', () => {
    const [parameterId] =
      Object.entries(template.toJSON().Parameters).find(
        ([, parameter]: [string, any]) => parameter.Default === config.mail.forwardToParameterName,
      ) ?? [];
    assert.ok(parameterId, `no parameter reads ${config.mail.forwardToParameterName}`);
    assert.equal(settings.forwardTo, JSON.stringify({ Ref: parameterId }));

    const [, subscription] = only('AWS::SNS::Subscription');
    assert.equal(subscription.Protocol, 'email');
    assert.deepEqual(subscription.Endpoint, { Ref: parameterId });
    const [, invokeConfig] = only('AWS::Lambda::EventInvokeConfig');
    assert.deepEqual(invokeConfig.FunctionName, { Ref: forwarderId });
    assert.deepEqual(invokeConfig.DestinationConfig.OnFailure.Destination, subscription.TopicArn);
  });

  it('lets the forwarder send only from the forwarded addresses', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      Roles: [{ Ref: resources[forwarderId].Properties.Role['Fn::GetAtt'][0] }],
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['ses:SendEmail', 'ses:SendRawEmail'],
            Condition: { StringEquals: { 'ses:FromAddress': received } },
          }),
        ]),
      },
    });
  });
});

// Text files of the site and the coming-soon page, where contact addresses are published.
const SITE_FOLDERS = ['apps/web/src', 'apps/web/public', 'infra/coming-soon'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mdx', '.json', '.txt', '.html', '.svg']);

describe('the site', () => {
  it('publishes only addresses at the domain that SES receives', () => {
    const atDomain = new RegExp(`[\\w.+-]+@${config.apexDomainName.replaceAll('.', '\\.')}`, 'gi');
    const published = new Set<string>();
    for (const folder of SITE_FOLDERS) {
      const files = readdirSync(join(repoRoot, folder), { recursive: true, encoding: 'utf8' });
      for (const file of files.filter((name) => TEXT_EXTENSIONS.has(extname(name)))) {
        const text = readFileSync(join(repoRoot, folder, file), 'utf8');
        for (const [address] of text.matchAll(atDomain)) published.add(address.toLowerCase());
      }
    }
    assert.ok(published.size > 0, 'expected the site to publish a contact address');
    for (const address of published) {
      assert.ok(
        received.includes(address),
        `${address} is published but not received; add it to config.mail.forwardedLocalParts`,
      );
    }
  });
});

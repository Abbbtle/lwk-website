import * as cdk from 'aws-cdk-lib/core';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { config, type StageConfig } from './config';

export type DeployAccessStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  artifactsBucket: s3.IBucket;
  instance: ec2.IInstance;
};

/**
 * Lets GitHub Actions deploy the web app with short-lived credentials (OIDC): no AWS keys are
 * stored in GitHub. The role can only upload release bundles and run commands on the web server,
 * and only from the stage's deploy branch.
 */
export class DeployAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DeployAccessStackProps) {
    super(scope, id, props);
    const { stage, deployBranch } = props.stageConfig;

    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const role = new iam.Role(this, 'GitHubDeployRole', {
      roleName: `lwk-${stage}-github-deploy`,
      description: `GitHub Actions deploys to LWK ${stage} from ${deployBranch}`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        // Only workflows running for the deploy branch of this repository.
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${config.githubRepository}:ref:refs/heads/${deployBranch}`,
        },
      }),
    });

    props.artifactsBucket.grantPut(role, 'web/*');
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:SendCommand'],
        resources: [
          `arn:aws:ec2:${this.region}:${this.account}:instance/${props.instance.instanceId}`,
          `arn:aws:ssm:${this.region}::document/AWS-RunShellScript`,
        ],
      }),
    );
    // The workflow reads the instance ID and bucket name from the app stack's outputs.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${this.region}:${this.account}:stack/lwk-${stage}-app/*`,
        ],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetCommandInvocation', 'ssm:ListCommandInvocations'],
        resources: ['*'], // these actions do not support resource-level permissions
      }),
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}

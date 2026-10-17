import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import { config, type StageConfig } from './config';

export type NetworkStackProps = cdk.StackProps & { stageConfig: StageConfig };

/**
 * VPC with public subnets (web server) and isolated subnets (database), no NAT gateway.
 * Security groups for both tiers live here so neither stack depends on the other.
 */
export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly webSecurityGroup: ec2.SecurityGroup;
  readonly databaseSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const { stage } = props.stageConfig;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `lwk-${stage}`,
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/16'),
      maxAzs: 2,
      // No NAT gateway (about USD 35/month): the web server sits in a public subnet and the
      // database in isolated subnets that have no internet route at all.
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      // Free gateway endpoint: S3 traffic stays on the AWS network.
      gatewayEndpoints: { S3: { service: ec2.GatewayVpcEndpointAwsService.S3 } },
    });

    this.webSecurityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc: this.vpc,
      description: 'LWK web server - HTTP from CloudFront only',
      allowAllOutbound: true,
    });
    // Only CloudFront can reach the app; there is no SSH (Session Manager is used instead).
    this.webSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(config.cloudFrontPrefixListId),
      ec2.Port.tcp(3000),
      'Next.js from CloudFront origin-facing IPs',
    );

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'LWK database - PostgreSQL from the web server only',
      allowAllOutbound: false,
    });
    this.databaseSecurityGroup.addIngressRule(
      this.webSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from the web server',
    );
  }
}

import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export type DataStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
};

/** PostgreSQL on RDS, reachable only from the web server's security group. */
export class DataStack extends cdk.Stack {
  readonly database: rds.DatabaseInstance;
  readonly databaseName = 'lwk';
  readonly databaseUser = 'lwk_admin';

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { stage } = props.stageConfig;

    this.database = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `lwk-${stage}`,
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_18_3 }),
      // Free plan eligible; single AZ until launch (Multi-AZ doubles the cost).
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      multiAz: false,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      publiclyAccessible: false,
      databaseName: this.databaseName,
      // RDS creates, stores (Secrets Manager) and rotates the password; nobody sees it.
      credentials: rds.Credentials.fromUsername(this.databaseUser),
      manageMasterUserPassword: true,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      // The AWS Free plan allows at most 1 day of automated backups; raise to 7+ days after
      // upgrading to the Paid plan (see docs/PLAN.md).
      backupRetention: cdk.Duration.days(1),
      preferredBackupWindow: '00:00-01:00', // 02:00-03:00 SAST
      preferredMaintenanceWindow: 'sun:01:30-sun:02:30',
      autoMinorVersionUpgrade: true,
      deletionProtection: true,
      // Keep a final snapshot if the database is ever deleted through CloudFormation.
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: 30,
    });
  }
}

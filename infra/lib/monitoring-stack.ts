import * as cdk from 'aws-cdk-lib/core';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export type MonitoringStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  instance: ec2.IInstance;
  database: rds.IDatabaseInstance;
  logGroup: logs.ILogGroup;
  appUrl: string;
  /** Where alerts are emailed. Passed at deploy time (ALERT_EMAIL), never committed. */
  alertEmail?: string;
};

const NAMESPACE = 'LWK';

/**
 * Alarms for the dev stage, all in one region and within the CloudWatch free tier (10 alarms):
 * automatic recovery and reboot of the web server, an uptime check through CloudFront, and
 * early warnings for CPU credits, database resources and app errors.
 */
export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    const { stage } = props.stageConfig;
    const instanceId = props.instance.instanceId;
    const dbId = props.database.instanceIdentifier;

    const topic = new sns.Topic(this, 'Alerts', {
      topicName: `lwk-${stage}-alerts`,
      displayName: `LWK ${stage} alerts`,
      enforceSSL: true,
    });
    if (props.alertEmail) {
      topic.addSubscription(new subscriptions.EmailSubscription(props.alertEmail));
    }
    const notify = new actions.SnsAction(topic);

    const alarm = (
      name: string,
      description: string,
      metric: cloudwatch.Metric,
      options: Omit<cloudwatch.CreateAlarmOptions, 'alarmName' | 'alarmDescription'>,
      extraActions: cloudwatch.IAlarmAction[] = [],
    ) => {
      const created = metric.createAlarm(this, name, {
        alarmName: `lwk-${stage}-${name}`,
        alarmDescription: description,
        ...options,
      });
      created.addAlarmAction(notify, ...extraActions);
      created.addOkAction(notify);
      return created;
    };

    const ec2Metric = (metricName: string, statistic: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName,
        dimensionsMap: { InstanceId: instanceId },
        statistic,
        period: cdk.Duration.minutes(1),
      });

    // ---- Web server ----
    alarm(
      'web-hardware-check',
      'AWS hardware under the web server failed its checks. The instance is recovered onto healthy hardware automatically.',
      ec2Metric('StatusCheckFailed_System', 'Maximum'),
      {
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      },
      [new actions.Ec2Action(actions.Ec2InstanceAction.RECOVER)],
    );
    alarm(
      'web-instance-check',
      'The web server operating system stopped responding. It is rebooted automatically.',
      ec2Metric('StatusCheckFailed_Instance', 'Maximum'),
      {
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      },
      [new actions.Ec2Action(actions.Ec2InstanceAction.REBOOT)],
    );
    alarm(
      'web-cpu-credits',
      'The web server has used most of its burst CPU credits; sustained load may slow the site or add cost.',
      new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUCreditBalance',
        dimensionsMap: { InstanceId: instanceId },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(5),
      }),
      {
        threshold: 20,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      },
    );

    // ---- Uptime check through CloudFront (every 5 minutes) ----
    const checkLogs = new logs.LogGroup(this, 'UptimeCheckLogs', {
      logGroupName: `/lwk/${stage}/uptime-check`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const checker = new lambda.Function(this, 'UptimeCheck', {
      description: `LWK ${stage} - checks ${props.appUrl}/api/v1/health`,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(20),
      logGroup: checkLogs,
      environment: { HEALTH_URL: `${props.appUrl}/api/v1/health`, STAGE: stage },
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const cloudwatch = new CloudWatchClient({});
exports.handler = async () => {
  let healthy = 0;
  try {
    const response = await fetch(process.env.HEALTH_URL, { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    healthy = response.ok && body?.data?.database === 'ok' ? 1 : 0;
    if (!healthy) console.log('Unhealthy response', response.status, JSON.stringify(body));
  } catch (error) {
    console.log('Health check failed', String(error));
  }
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: '${NAMESPACE}',
    MetricData: [{ MetricName: 'SiteHealthy', Dimensions: [{ Name: 'Stage', Value: process.env.STAGE }], Value: healthy, Unit: 'Count' }],
  }));
  return { healthy };
};`),
    });
    checker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'], // PutMetricData has no resource-level permissions
        conditions: { StringEquals: { 'cloudwatch:namespace': NAMESPACE } },
      }),
    );
    new events.Rule(this, 'UptimeSchedule', {
      description: `Runs the LWK ${stage} uptime check every 5 minutes`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(checker)],
    });
    alarm(
      'site-down',
      `The site (${props.appUrl}) or its database has been failing health checks for 10 minutes.`,
      new cloudwatch.Metric({
        namespace: NAMESPACE,
        metricName: 'SiteHealthy',
        dimensionsMap: { Stage: stage },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(5),
      }),
      {
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        // No data means the checker itself is not running: treat as down.
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      },
    );

    // ---- App errors in the web server log ----
    new logs.MetricFilter(this, 'AppErrors', {
      logGroup: props.logGroup,
      metricNamespace: NAMESPACE,
      metricName: `AppErrors-${stage}`,
      // Next.js prints uncaught errors with "⨯"; the app logs handled failures with "failed"
      // or "Unhandled".
      filterPattern: logs.FilterPattern.anyTerm('⨯', 'Unhandled', 'failed'),
      metricValue: '1',
      defaultValue: 0,
    });
    alarm(
      'app-errors',
      'The web app logged 5 or more errors in 5 minutes. Check the /lwk log group.',
      new cloudwatch.Metric({
        namespace: NAMESPACE,
        metricName: `AppErrors-${stage}`,
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      {
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    // ---- Database ----
    const rdsMetric = (metricName: string, statistic: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName,
        dimensionsMap: { DBInstanceIdentifier: dbId },
        statistic,
        period: cdk.Duration.minutes(5),
      });
    alarm(
      'db-cpu',
      'Database CPU above 80% for 15 minutes.',
      rdsMetric('CPUUtilization', 'Average'),
      {
        threshold: 80,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      },
    );
    alarm(
      'db-storage',
      'Database free storage below 2 GB (it auto-grows up to 50 GB).',
      rdsMetric('FreeStorageSpace', 'Minimum'),
      {
        threshold: 2 * 1024 ** 3,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      },
    );
    alarm(
      'db-memory',
      'Database freeable memory below 64 MB for 15 minutes.',
      rdsMetric('FreeableMemory', 'Average'),
      {
        threshold: 64 * 1024 ** 2,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      },
    );

    new cdk.CfnOutput(this, 'AlertTopicArn', { value: topic.topicArn });
  }
}

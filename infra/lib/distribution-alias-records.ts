import * as cdk from 'aws-cdk-lib/core';
import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export type DistributionAliasRecordsProps = {
  zone: route53.IHostedZone;
  /** Fully qualified host name inside the zone: the apex or one of its subdomains. */
  hostName: string;
  distribution: cloudfront.IDistribution;
};

/** IPv4 and IPv6 alias records that point a host name at a CloudFront distribution. */
export class DistributionAliasRecords extends Construct {
  constructor(scope: Construct, id: string, props: DistributionAliasRecordsProps) {
    super(scope, id);
    const { zone, hostName } = props;
    const zoneName = zone.zoneName;
    if (
      !cdk.Token.isUnresolved(zoneName) &&
      hostName !== zoneName &&
      !hostName.endsWith(`.${zoneName}`)
    ) {
      throw new Error(`${hostName} is not in the zone ${zoneName}`);
    }

    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(props.distribution));
    new route53.ARecord(this, 'IPv4', { zone, recordName: hostName, target });
    new route53.AaaaRecord(this, 'IPv6', { zone, recordName: hostName, target });
  }
}

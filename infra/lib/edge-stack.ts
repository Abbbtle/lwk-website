import * as cdk from 'aws-cdk-lib/core';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';
import { assertInEdgeRegion } from './edge-region';

export type EdgeStackProps = cdk.StackProps & {
  stageConfig: StageConfig;
  /** The shared zone (lwk-domain) that holds the certificate's validation records. */
  hostedZone: route53.IHostedZone;
};

/**
 * Per-stage resources that CloudFront only accepts from us-east-1: the TLS certificate for the
 * stage's site, validated by DNS records in the shared zone (a web ACL would also live here).
 * The app stack in the workload region uses the certificate through a weak reference.
 */
export class EdgeStack extends cdk.Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, props);
    assertInEdgeRegion(this);
    const { stage, siteHostName } = props.stageConfig;

    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      certificateName: `lwk-${stage}-site`,
      domainName: siteHostName,
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });
  }
}

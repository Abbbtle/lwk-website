import * as cdk from 'aws-cdk-lib/core';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export type DomainStackProps = cdk.StackProps & {
  /** The registered domain, which is the zone apex, for example "livingwithkrishna.com". */
  apexDomainName: string;
};

/**
 * Public DNS for the registered domain, shared by every stage. The domain is registered at
 * GoDaddy; its name servers there must be the four values in the `NameServers` output. Other
 * stacks create their own records in this zone and validate certificates against it through
 * weak cross-stack references, which also work across regions (CloudFront certificates live
 * in us-east-1).
 *
 * The zone's identity is load-bearing: once the name servers are set at GoDaddy, the stack id
 * (lwk-domain), its region and the zone's logical ID must not change. Changing any of them
 * creates a second zone with different name servers, while RETAIN keeps the old zone that
 * GoDaddy still points at.
 */
export class DomainStack extends cdk.Stack {
  /**
   * The public hosted zone for the domain. Pass it to stacks in any region: the records and
   * certificate validations they create live in their own stack and reference this zone weakly.
   * For host names use `hostedZone.zoneName`, a plain string that adds no cross-stack reference.
   */
  readonly hostedZone: route53.IPublicHostedZone;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    // A hosted zone has no deletion protection of its own, and weak references do not hold this
    // stack in place, so termination protection is on unless a caller turns it off.
    super(scope, id, { ...props, terminationProtection: props.terminationProtection ?? true });

    const zone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: props.apexDomainName,
      comment: `LWK - public DNS for ${props.apexDomainName} (registered at GoDaddy)`,
    });
    // Pinned so that refactoring the construct tree can never replace the zone.
    (zone.node.defaultChild as route53.CfnHostedZone).overrideLogicalId('HostedZone');
    // Keep the zone if the stack is ever deleted: the site and its email depend on it.
    zone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.hostedZone = zone;

    new cdk.CfnOutput(this, 'NameServers', {
      description: 'Name servers to set for the domain at GoDaddy',
      value: cdk.Fn.join(', ', zone.hostedZoneNameServers!),
    });
    new cdk.CfnOutput(this, 'HostedZoneId', { value: zone.hostedZoneId });
  }
}

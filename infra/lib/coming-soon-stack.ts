import * as cdk from 'aws-cdk-lib/core';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { CanonicalHostRedirect } from './canonical-host-redirect';
import { DistributionAliasRecords } from './distribution-alias-records';
import { assertInEdgeRegion } from './edge-region';
import { githubBranchPrincipal, githubOidcProviderArn } from './github-oidc';

export type ComingSoonStackProps = cdk.StackProps & {
  /** The shared zone (lwk-domain); the page is served at its apex and at www. */
  hostedZone: route53.IHostedZone;
  /**
   * Git branch whose workflow may publish the page (GitHub Actions, OIDC). publish-main-site.yml
   * must trigger on the same branch (checked by infra/test).
   */
  publishBranch: string;
};

/**
 * The main address (and www) until production launches: a static coming-soon page in a private
 * S3 bucket behind its own CloudFront distribution, apart from the dev stage. The page lives in
 * infra/coming-soon and is published from the production branch by GitHub Actions
 * (.github/workflows/publish-main-site.yml) through the publish role below, so the main address
 * always shows that branch's page. Deployed to us-east-1, next to its certificate.
 *
 * When production takes over the main address, destroy this stack first (turn off its
 * termination protection): that removes the apex and www records and frees the CloudFront
 * aliases for the production distribution. Delete publish-main-site.yml and infra/coming-soon in
 * the same change. The main address is offline in between.
 */
export class ComingSoonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComingSoonStackProps) {
    super(scope, id, props);
    assertInEdgeRegion(this);
    const apexHostName = props.hostedZone.zoneName;
    const wwwHostName = `www.${apexHostName}`;

    const bucket = new s3.Bucket(this, 'PageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Holds only the page, which the publish workflow uploads again from the repository.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      certificateName: 'lwk-coming-soon',
      domainName: apexHostName,
      subjectAlternativeNames: [wwwHostName],
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });

    // www (and the distribution's own address) move to the main address.
    const redirect = new CanonicalHostRedirect(this, 'CanonicalHost', {
      canonicalHostName: apexHostName,
      comment: `LWK - redirects www and other host names to ${apexHostName}`,
    });

    // A static page with no scripts, so the content security policy can be strict. The page in
    // infra/coming-soon must keep to it (styles, images and fonts from this site only, no scripts
    // or inline styles; checked by infra/test). It is published separately, from main, so deploy
    // this stack before main publishes a page that needs more.
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'LWK coming-soon page - security headers',
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; " +
            "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(730),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'LWK - coming-soon page',
      domainNames: [apexHostName, wwwHostName],
      certificate,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes South Africa
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        functionAssociations: [redirect.functionAssociation],
      },
      // The bucket answers 403 for files that do not exist: index.html is also the 404 page.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(5),
      })),
    });

    // GitHub Actions publishes the page from the production branch with short-lived credentials
    // (OIDC); no AWS keys are stored in GitHub. The workflow hard-codes this role's name (it needs
    // the role before it can read this stack's outputs), so the name must not change.
    const publishRole = new iam.Role(this, 'PublishRole', {
      roleName: `${this.stackName}-github-publish`,
      description: `GitHub Actions publishes ${apexHostName} from ${props.publishBranch}`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: githubBranchPrincipal(githubOidcProviderArn(this.account), props.publishBranch),
    });
    bucket.grantReadWrite(publishRole);
    distribution.grant(publishRole, 'cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation');
    // The workflow reads the bucket and distribution from this stack's outputs.
    publishRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [this.stackId],
      }),
    );

    new DistributionAliasRecords(this, 'ApexAddress', {
      zone: props.hostedZone,
      hostName: apexHostName,
      distribution,
    });
    new DistributionAliasRecords(this, 'WwwAddress', {
      zone: props.hostedZone,
      hostName: wwwHostName,
      distribution,
    });

    // publish-main-site.yml reads SiteUrl, PageBucketName and DistributionId by key (checked by
    // infra/test); PublishRoleArn is for reference.
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${apexHostName}` });
    new cdk.CfnOutput(this, 'PageBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'PublishRoleArn', { value: publishRole.roleArn });
  }
}

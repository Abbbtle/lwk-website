import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { CanonicalHostRedirect } from './canonical-host-redirect';
import { DistributionAliasRecords } from './distribution-alias-records';
import { assertInEdgeRegion } from './edge-region';

export type ComingSoonStackProps = cdk.StackProps & {
  /** The shared zone (lwk-domain); the page is served at its apex and at www. */
  hostedZone: route53.IHostedZone;
};

/**
 * A static coming-soon page on the main address (and www) until production launches, served
 * from a private S3 bucket by its own CloudFront distribution, apart from the dev stage. The page
 * lives in infra/coming-soon. Delete this stack when production takes over the main address.
 * Deployed to us-east-1 so that its certificate sits next to the distribution.
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
      // Holds only the page, which every deploy uploads again from the repository.
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

    // A static page with no scripts, so the content security policy can be strict.
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
      // The bucket answers 403 for files that do not exist: show the page with a 404 status.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.minutes(5),
      })),
    });

    // Upload the page and clear the CloudFront cache on every deploy.
    new s3deploy.BucketDeployment(this, 'Page', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'coming-soon'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

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

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${apexHostName}` });
  }
}

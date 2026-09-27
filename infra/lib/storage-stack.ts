import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export type StorageStackProps = cdk.StackProps & { stageConfig: StageConfig };

/**
 * Course media: lesson videos, PDFs and cover images. The bucket is private; browsers upload
 * with short-lived presigned POST forms issued by the app, and files are served through signed
 * URLs (CloudFront in production, Phase 6).
 */
export class StorageStack extends cdk.Stack {
  readonly mediaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    const { stage, appOrigins } = props.stageConfig;

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `lwk-${stage}-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      // Browser uploads (POST) and in-page previews (GET) from the app's origins.
      cors: [
        {
          allowedOrigins: appOrigins,
          allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'abort-incomplete-multipart',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      // Course content: keep the bucket and its files if the stack is ever deleted.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
  }
}

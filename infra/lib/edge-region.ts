import type * as cdk from 'aws-cdk-lib/core';
import { config } from './config';

/**
 * Fails synth unless the stack is in the edge region, where CloudFront reads certificates. Every
 * stack that holds a certificate for a distribution calls this.
 */
export function assertInEdgeRegion(stack: cdk.Stack): void {
  if (stack.region !== config.edgeRegion) {
    throw new Error(
      `${stack.stackName} is in ${stack.region}, but must be in ${config.edgeRegion}, ` +
        'where CloudFront reads certificates',
    );
  }
}

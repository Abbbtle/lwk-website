// Shared settings for every LWK stack.
export const config = {
  project: 'lwk',
  account: '455280338092',
  // Cape Town, closest region to our first users. CloudFront serves everyone else.
  region: 'af-south-1',
} as const;

export type StageConfig = {
  /** Short name used in stack names and resource prefixes, e.g. "dev". */
  stage: string;
  /** Prefix for the Cognito hosted sign-in domain (<prefix>.auth.<region>.amazoncognito.com). */
  authDomainPrefix: string;
  /** Origins allowed to receive sign-in redirects, e.g. http://localhost:3000. */
  appOrigins: string[];
};

// One AWS environment while on the Free plan (see docs/PLAN.md, "Branches and environments").
export const stages: Record<string, StageConfig> = {
  dev: {
    stage: 'dev',
    authDomainPrefix: 'livingwithkrishna-dev',
    // The CloudFront URL is added in Phase 6.
    appOrigins: ['http://localhost:3000'],
  },
};

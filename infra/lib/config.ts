// Shared settings for every LWK stack.
export const config = {
  project: 'lwk',
  account: '455280338092',
  // Cape Town, closest region to our first users. CloudFront serves everyone else.
  region: 'af-south-1',
  // GitHub repository allowed to deploy (OIDC), see DeployAccessStack.
  githubRepository: 'Abbbtle/lwk-website',
  // AWS-managed prefix list of CloudFront origin-facing IPs in af-south-1
  // (com.amazonaws.global.cloudfront.origin-facing).
  cloudFrontPrefixListId: 'pl-c0aa4fa9',
  // Versions installed on the web server; keep in step with .nvmrc and apps/web/package.json.
  nodeVersion: '24.21.0',
  prismaVersion: '7.10.0',
  // Pinned so a newly published image never replaces the running server on an unrelated
  // deploy. Changing it rebuilds the server (plan a deploy afterwards). OS security patches
  // on the running server come from dnf / Systems Manager Patch Manager.
  // al2023-ami-2023.12.20260918.0-kernel-6.1-arm64
  webServerAmi: 'ami-02ab347c9808072ec',
} as const;

export type StageConfig = {
  /** Short name used in stack names and resource prefixes, e.g. "dev". */
  stage: string;
  /** Prefix for the Cognito hosted sign-in domain (<prefix>.auth.<region>.amazoncognito.com). */
  authDomainPrefix: string;
  /**
   * Origins allowed to receive sign-in redirects and upload to the media bucket. The CloudFront
   * URL is added after the first deploy of the app stack (it is only known then).
   */
  appOrigins: string[];
  /** Git branch that deploys to this stage. */
  deployBranch: string;
  /** Claude on Amazon Bedrock (global inference profile IDs) and the monthly AI spending cap. */
  ai: { assistantModel: string; writerModel: string; monthlyBudgetUsd: number };
};

// One AWS environment while on the Free plan (see docs/PLAN.md, "Branches and environments").
export const stages: Record<string, StageConfig> = {
  dev: {
    stage: 'dev',
    authDomainPrefix: 'livingwithkrishna-dev',
    appOrigins: ['http://localhost:3000', 'https://d1uih31m6ki5c2.cloudfront.net'],
    deployBranch: 'dev',
    ai: {
      assistantModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      writerModel: 'global.anthropic.claude-sonnet-5',
      monthlyBudgetUsd: 5,
    },
  },
};

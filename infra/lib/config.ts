// Shared settings for every LWK stack.
export const config = {
  project: 'lwk',
  account: '455280338092',
  // Cape Town, closest region to our first users. CloudFront serves everyone else.
  region: 'af-south-1',
  // The registered domain (zone apex), at GoDaddy; its DNS is the Route 53 zone in the shared
  // lwk-domain stack. Stage sites use subdomains of it; production keeps the apex.
  apexDomainName: 'livingwithkrishna.com',
  // CloudFront only uses certificates (and web ACLs) from this region.
  edgeRegion: 'us-east-1',
  // Git branch that publishes the main address (the coming-soon page until production launches).
  productionBranch: 'main',
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
   * Public host name of the stage's site, a subdomain of `config.apexDomainName` (production
   * will use the apex itself). Other host names that reach the distribution redirect here.
   */
  siteHostName: string;
  /**
   * Whether search engines may index the site. Only production should; other stages send
   * `X-Robots-Tag: noindex, nofollow` with every response.
   */
  searchIndexing: boolean;
  /**
   * Origins allowed to receive sign-in redirects and upload to the media bucket besides the site
   * itself, which `appOrigins()` always puts first: local development and, while the site moves
   * to a new host name, the previous address.
   */
  extraAppOrigins: string[];
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
    siteHostName: `dev.${config.apexDomainName}`,
    searchIndexing: false,
    extraAppOrigins: ['http://localhost:3000'],
    deployBranch: 'dev',
    ai: {
      assistantModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      writerModel: 'global.anthropic.claude-sonnet-5',
      monthlyBudgetUsd: 5,
    },
  },
};

/** The stage's public address, which the app knows as APP_URL. */
export function siteUrl(stageConfig: StageConfig): string {
  return `https://${stageConfig.siteHostName}`;
}

/**
 * Origins allowed to receive sign-in redirects and upload to the media bucket, the site first.
 * Throws if an extra origin is not a bare origin: Cognito appends paths to these and S3 compares
 * them exactly with the browser's Origin header.
 */
export function appOrigins(stageConfig: StageConfig): string[] {
  for (const origin of stageConfig.extraAppOrigins) {
    if (!isBareOrigin(origin)) {
      throw new Error(
        `extraAppOrigins of stage ${stageConfig.stage} must be bare origins such as ` +
          `"http://localhost:3000" (scheme, host and optional port; no path or trailing slash), ` +
          `got "${origin}"`,
      );
    }
  }
  return [siteUrl(stageConfig), ...stageConfig.extraAppOrigins];
}

function isBareOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

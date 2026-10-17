import * as iam from 'aws-cdk-lib/aws-iam';
import { config } from './config';

const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com';

/** GitHub Actions' OpenID Connect issuer. IAM allows one identity provider per issuer per account. */
export const GITHUB_OIDC_URL = `https://${GITHUB_OIDC_HOST}`;

/**
 * ARN of the account's GitHub Actions identity provider. The provider is account-wide but is
 * created by the dev stage's deploy-access stack (lwk-dev-deploy-access); the coming-soon
 * publish role trusts it too, so that stack must not be destroyed while lwk-coming-soon exists.
 */
export function githubOidcProviderArn(account: string): string {
  return `arn:aws:iam::${account}:oidc-provider/${GITHUB_OIDC_HOST}`;
}

/**
 * Who may assume a role from GitHub Actions: only workflows of this repository running for the
 * given branch, with the STS audience. Every GitHub-facing role uses this, so the trust rules
 * change in one place.
 */
export function githubBranchPrincipal(
  providerArn: string,
  branch: string,
): iam.WebIdentityPrincipal {
  return new iam.WebIdentityPrincipal(providerArn, {
    StringEquals: { [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com' },
    StringLike: {
      [`${GITHUB_OIDC_HOST}:sub`]: `repo:${config.githubRepository}:ref:refs/heads/${branch}`,
    },
  });
}

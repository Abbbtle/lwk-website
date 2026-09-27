// Auth settings and the OpenID Connect client configuration. Also used by src/proxy.ts,
// so this module must not import `server-only`.
import * as oidc from 'openid-client';
import { z } from 'zod';

const envSchema = z.object({
  APP_URL: z.url().transform((url) => url.replace(/\/$/, '')),
  COGNITO_USER_POOL_ID: z.string().regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_DOMAIN: z.url().transform((url) => url.replace(/\/$/, '')),
});

export type AuthConfig = {
  appUrl: string;
  userPoolId: string;
  clientId: string;
  /** Hosted sign-in domain, e.g. https://<prefix>.auth.<region>.amazoncognito.com */
  domain: string;
  issuer: string;
  redirectUri: string;
  /** Cookies get the Secure flag whenever the app is served over HTTPS. */
  secureCookies: boolean;
};

let authConfig: AuthConfig | undefined;

/** Read lazily so builds and pages that never touch auth don't need these variables. */
export function getAuthConfig(): AuthConfig {
  if (!authConfig) {
    const env = envSchema.parse(process.env);
    const region = env.COGNITO_USER_POOL_ID.split('_')[0];
    authConfig = {
      appUrl: env.APP_URL,
      userPoolId: env.COGNITO_USER_POOL_ID,
      clientId: env.COGNITO_CLIENT_ID,
      domain: env.COGNITO_DOMAIN,
      issuer: `https://cognito-idp.${region}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`,
      redirectUri: `${env.APP_URL}/auth/callback`,
      secureCookies: env.APP_URL.startsWith('https://'),
    };
  }
  return authConfig;
}

let discovery: Promise<oidc.Configuration> | undefined;

/** OIDC discovery, fetched once per server process (retried after a failure). */
export function getOidcConfig(): Promise<oidc.Configuration> {
  if (!discovery) {
    const { issuer, clientId } = getAuthConfig();
    // Public client: PKCE instead of a client secret.
    discovery = oidc.discovery(new URL(issuer), clientId, undefined, oidc.None()).catch((error) => {
      discovery = undefined;
      throw error;
    });
  }
  return discovery;
}

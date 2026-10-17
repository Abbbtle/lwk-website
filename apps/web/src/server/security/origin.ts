// Only our CloudFront distribution may reach the server. The security group already limits
// connections to CloudFront's address ranges, but any CloudFront distribution uses those. Ours
// adds a secret header to every request it forwards; requests without it are refused.
// Must not import `server-only` (used by the proxy).
import { timingSafeEqual } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export const ORIGIN_HEADER = 'x-origin-verify';

// Called by the deploy script on the server itself, without going through CloudFront.
const EXEMPT_PATHS = new Set(['/api/v1/health']);

const CACHE_MS = 10 * 60_000;

let cached: { value: string; fetchedAt: number } | undefined;
let client: SecretsManagerClient | undefined;

/** The expected header value, or null where there is no CloudFront (local development). */
async function expectedValue(): Promise<string | null> {
  const secretArn = process.env.ORIGIN_SECRET_ARN;
  if (!secretArn) return null;
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;
  client ??= new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'af-south-1' });
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!SecretString) throw new Error('Origin secret is empty');
  cached = { value: SecretString, fetchedAt: Date.now() };
  return SecretString;
}

function sameValue(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type OriginCheck = 'allowed' | 'forbidden' | 'unavailable';

export async function checkOrigin(pathname: string, headers: Headers): Promise<OriginCheck> {
  if (EXEMPT_PATHS.has(pathname)) return 'allowed';
  let expected: string | null;
  try {
    expected = await expectedValue();
  } catch (error) {
    console.error('Origin secret lookup failed', error);
    return 'unavailable';
  }
  if (expected === null) return 'allowed';
  const received = headers.get(ORIGIN_HEADER);
  return received && sameValue(received, expected) ? 'allowed' : 'forbidden';
}

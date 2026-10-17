// Content Security Policy, built per request with a fresh nonce (see src/proxy.ts). Next.js
// reads the nonce from the request's policy header and adds it to its own scripts, so only
// scripts this server rendered can run. Must not import `server-only` (used by the proxy).

/** A random nonce for one response. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

function mediaOrigin(): string | undefined {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) return undefined;
  return `https://${bucket}.s3.${process.env.AWS_REGION ?? 'af-south-1'}.amazonaws.com`;
}

function cognitoOrigin(): string | undefined {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId) return undefined;
  return `https://cognito-idp.${poolId.split('_')[0]}.amazonaws.com`;
}

export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  // Course media (images, video, PDFs) comes from signed S3 links; browsers upload there too.
  const media = mediaOrigin();
  // The sign-in pages talk to Cognito directly (the password never reaches this server).
  const cognito = cognitoOrigin();

  const directives: Record<string, (string | undefined | false)[]> = {
    'default-src': ["'self'"],
    // React needs eval for its development tooling only.
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev && "'unsafe-eval'"],
    // Inline style attributes (progress bars) are harmless without script execution.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', media],
    'media-src': ["'self'", 'blob:', media],
    'font-src': ["'self'"],
    'connect-src': ["'self'", cognito, media, dev && 'ws:'],
    'frame-src': ["'self'", media],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, sources]) =>
    [name, ...sources.filter(Boolean)].join(' '),
  );
  if (!dev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

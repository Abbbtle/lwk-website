import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipFromHeaders } from '../request-info';
import { contentSecurityPolicy, createNonce } from './csp';

const send = vi.hoisted(() => vi.fn(async () => ({ SecretString: 'expected-secret-value' })));
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = send;
  },
  GetSecretValueCommand: class {
    constructor(readonly input: unknown) {}
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('ipFromHeaders', () => {
  it('reads the viewer address CloudFront sets, for IPv4 and IPv6', () => {
    expect(ipFromHeaders(new Headers({ 'cloudfront-viewer-address': '198.51.100.10:46532' }))).toBe(
      '198.51.100.10',
    );
    expect(ipFromHeaders(new Headers({ 'cloudfront-viewer-address': '2001:db8::1:46532' }))).toBe(
      '2001:db8::1',
    );
  });

  it('ignores X-Forwarded-For, which visitors can set themselves', () => {
    expect(ipFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('local');
  });
});

describe('contentSecurityPolicy', () => {
  it('allows only nonce-carrying scripts, plus media and sign-in origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MEDIA_BUCKET', 'media-bucket');
    vi.stubEnv('AWS_REGION', 'af-south-1');
    vi.stubEnv('COGNITO_USER_POOL_ID', 'af-south-1_Abc');
    const nonce = createNonce();
    const policy = contentSecurityPolicy(nonce);
    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic';`);
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('https://media-bucket.s3.af-south-1.amazonaws.com');
    expect(policy).toContain('https://cognito-idp.af-south-1.amazonaws.com');
    expect(policy).toContain('upgrade-insecure-requests');
  });

  it('gives every response its own nonce', () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});

describe('checkOrigin', () => {
  it('allows everything where there is no CloudFront (no secret configured)', async () => {
    vi.stubEnv('ORIGIN_SECRET_ARN', '');
    const { checkOrigin } = await import('./origin');
    expect(await checkOrigin('/', new Headers())).toBe('allowed');
  });

  it('requires the secret header in AWS, except for the deploy health check', async () => {
    vi.stubEnv('ORIGIN_SECRET_ARN', 'arn:aws:secretsmanager:af-south-1:1:secret:origin');
    const { checkOrigin, ORIGIN_HEADER } = await import('./origin');
    expect(await checkOrigin('/', new Headers())).toBe('forbidden');
    expect(await checkOrigin('/', new Headers({ [ORIGIN_HEADER]: 'wrong' }))).toBe('forbidden');
    expect(await checkOrigin('/', new Headers({ [ORIGIN_HEADER]: 'expected-secret-value' }))).toBe(
      'allowed',
    );
    expect(await checkOrigin('/api/v1/health', new Headers())).toBe('allowed');
  });

  it('fails closed when the secret cannot be read', async () => {
    vi.stubEnv('ORIGIN_SECRET_ARN', 'arn:aws:secretsmanager:af-south-1:1:secret:origin');
    send.mockRejectedValueOnce(new Error('Secrets Manager unreachable'));
    const { checkOrigin } = await import('./origin');
    expect(await checkOrigin('/', new Headers())).toBe('unavailable');
  });
});

import { createSign, generateKeyPairSync, type KeyObject, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSessionVerifier, hasRole, type Session } from './session';

const userPoolId = 'af-south-1_Test123';
const clientId = 'test-client';
const issuer = `https://cognito-idp.af-south-1.amazonaws.com/${userPoolId}`;
const kid = 'test-key';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const verifier = createSessionVerifier({ userPoolId, clientId });
verifier.cacheJwks({
  keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }],
} as Parameters<typeof verifier.cacheJwks>[0]);

function sign(claims: Record<string, unknown>, key: KeyObject = privateKey) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', kid, typ: 'JWT' })}.${encode(claims)}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  return `${unsigned}.${signature}`;
}

const now = () => Math.floor(Date.now() / 1000);

function tokens({
  sub = randomUUID(),
  groups,
  expiresIn = 900,
  accessClientId = clientId,
  idSub,
  key,
}: {
  sub?: string;
  groups?: string[];
  expiresIn?: number;
  accessClientId?: string;
  idSub?: string;
  key?: KeyObject;
} = {}) {
  const common = { iss: issuer, iat: now(), auth_time: now(), exp: now() + expiresIn };
  const access = sign(
    {
      ...common,
      sub,
      token_use: 'access',
      client_id: accessClientId,
      scope: 'openid email profile',
      username: sub,
      jti: randomUUID(),
      ...(groups && { 'cognito:groups': groups }),
    },
    key,
  );
  const id = sign(
    {
      ...common,
      sub: idSub ?? sub,
      token_use: 'id',
      aud: clientId,
      email: 'learner@example.org',
      email_verified: true,
      name: 'Test Learner',
    },
    key,
  );
  return { access, id, sub };
}

describe('session verifier', () => {
  it('returns the user for a valid token pair', async () => {
    const t = tokens();
    expect(await verifier.verify(t.access, t.id)).toEqual({
      userId: t.sub,
      email: 'learner@example.org',
      name: 'Test Learner',
      roles: [],
    });
  });

  it('keeps only known roles from Cognito groups', async () => {
    const t = tokens({ groups: ['instructor', 'some-other-group'] });
    expect((await verifier.verify(t.access, t.id))?.roles).toEqual(['instructor']);
  });

  it('rejects missing, expired, foreign or forged tokens', async () => {
    const valid = tokens();
    expect(await verifier.verify(undefined, valid.id)).toBeNull();
    expect(await verifier.verify(valid.access, undefined)).toBeNull();

    const expired = tokens({ expiresIn: -60 });
    expect(await verifier.verify(expired.access, expired.id)).toBeNull();

    const otherClient = tokens({ accessClientId: 'another-client' });
    expect(await verifier.verify(otherClient.access, otherClient.id)).toBeNull();

    const forged = tokens({ key: otherKey });
    expect(await verifier.verify(forged.access, forged.id)).toBeNull();

    const tampered = `${valid.access.slice(0, -4)}AAAA`;
    expect(await verifier.verify(tampered, valid.id)).toBeNull();
  });

  it('rejects an access token and ID token that belong to different users', async () => {
    const t = tokens({ idSub: randomUUID() });
    expect(await verifier.verify(t.access, t.id)).toBeNull();
  });
});

describe('hasRole', () => {
  const session = (roles: Session['roles']): Session => ({
    userId: 'u',
    email: 'e',
    name: 'n',
    roles,
  });

  it('grants a role to its members and everything to admins', () => {
    expect(hasRole(session([]), 'instructor')).toBe(false);
    expect(hasRole(session(['instructor']), 'instructor')).toBe(true);
    expect(hasRole(session(['instructor']), 'admin')).toBe(false);
    expect(hasRole(session(['admin']), 'instructor')).toBe(true);
  });
});

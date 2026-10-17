import { createSign, generateKeyPairSync, type KeyObject, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type AccountState,
  applyAccountState,
  createSessionVerifier,
  hasRole,
  type Session,
  type TokenIdentity,
} from './session';

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
      issuedAt: expect.any(Number),
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

describe('applyAccountState', () => {
  const issuedAt = 1_800_000_000;
  const identity = (roles: TokenIdentity['roles'] = []): TokenIdentity => ({
    userId: 'u',
    email: 'e',
    name: 'n',
    roles,
    issuedAt,
  });
  const account = (overrides: Partial<AccountState> = {}): AccountState => ({
    roles: [],
    rolesChangedAt: null,
    sessionsValidAfter: null,
    mfaEnabled: false,
    disabledAt: null,
    ...overrides,
  });
  const at = (seconds: number) => new Date(seconds * 1000);
  const options = { requireStaffMfa: true };

  it('uses the token as it is for an account without overrides (or no row yet)', () => {
    expect(applyAccountState(identity(['instructor']), account(), options)?.roles).toEqual([
      'instructor',
    ]);
    expect(applyAccountState(identity(['instructor']), null, options)?.roles).toEqual([
      'instructor',
    ]);
  });

  it('rejects disabled accounts and tokens issued before a sign-out everywhere', () => {
    expect(
      applyAccountState(identity(), account({ disabledAt: at(issuedAt - 10) }), options),
    ).toBeNull();
    expect(
      applyAccountState(identity(), account({ sessionsValidAfter: at(issuedAt + 1) }), options),
    ).toBeNull();
    // A token issued in the same second as (or after) the sign-out is a new session.
    expect(
      applyAccountState(identity(), account({ sessionsValidAfter: at(issuedAt) }), options),
    ).not.toBeNull();
  });

  it('applies role changes made after the token was issued', () => {
    const revoked = account({ roles: [], rolesChangedAt: at(issuedAt + 5) });
    expect(applyAccountState(identity(['instructor']), revoked, options)?.roles).toEqual([]);

    const granted = account({ roles: ['instructor', 'unknown'], rolesChangedAt: at(issuedAt + 5) });
    expect(applyAccountState(identity(), granted, options)?.roles).toEqual(['instructor']);

    // A token issued after the change already carries the new groups.
    const older = account({ roles: [], rolesChangedAt: at(issuedAt - 5) });
    expect(applyAccountState(identity(['instructor']), older, options)?.roles).toEqual([
      'instructor',
    ]);
  });

  it('locks staff roles until two-step verification is on', () => {
    const locked = applyAccountState(identity(['admin', 'instructor']), account(), options);
    expect(locked).toMatchObject({
      roles: ['instructor'],
      lockedRoles: ['admin'],
      mfaEnabled: false,
    });

    const support = applyAccountState(identity(['support']), account(), options);
    expect(support).toMatchObject({ roles: [], lockedRoles: ['support'] });

    const unlocked = applyAccountState(identity(['admin']), account({ mfaEnabled: true }), options);
    expect(unlocked).toMatchObject({ roles: ['admin'], lockedRoles: [], mfaEnabled: true });

    const notRequired = applyAccountState(identity(['admin']), account(), {
      requireStaffMfa: false,
    });
    expect(notRequired).toMatchObject({ roles: ['admin'], lockedRoles: [] });
  });
});

describe('hasRole', () => {
  const session = (roles: Session['roles']): Session => ({
    userId: 'u',
    email: 'e',
    name: 'n',
    roles,
    issuedAt: 0,
    mfaEnabled: true,
    lockedRoles: [],
  });

  it('grants a role to its members and everything to admins', () => {
    expect(hasRole(session([]), 'instructor')).toBe(false);
    expect(hasRole(session(['instructor']), 'instructor')).toBe(true);
    expect(hasRole(session(['instructor']), 'admin')).toBe(false);
    expect(hasRole(session(['admin']), 'instructor')).toBe(true);
  });
});

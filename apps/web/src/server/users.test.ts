import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { recordSignIn } from './users';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('recordSignIn', () => {
  it('creates the user on first sign-in and keeps details current afterwards', async () => {
    const id = randomUUID();
    await recordSignIn({ id, email: 'first@example.org', name: 'First Name', roles: [] });
    const created = await getDb().user.findUniqueOrThrow({ where: { id } });
    expect(created).toMatchObject({
      email: 'first@example.org',
      name: 'First Name',
      roles: [],
      mfaEnabled: false,
    });

    await recordSignIn({
      id,
      email: 'changed@example.org',
      name: 'Changed Name',
      roles: ['instructor'],
      mfaEnabled: true,
    });
    const updated = await getDb().user.findUniqueOrThrow({ where: { id } });
    expect(updated).toMatchObject({
      email: 'changed@example.org',
      name: 'Changed Name',
      roles: ['instructor'],
      mfaEnabled: true,
    });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.lastSignInAt.getTime()).toBeGreaterThanOrEqual(created.lastSignInAt.getTime());
  });

  it('keeps the stored two-step status when Cognito could not be asked', async () => {
    const id = randomUUID();
    await recordSignIn({ id, email: 'a@example.org', name: 'A', roles: [], mfaEnabled: true });
    await recordSignIn({ id, email: 'a@example.org', name: 'A', roles: [] });
    expect((await getDb().user.findUniqueOrThrow({ where: { id } })).mfaEnabled).toBe(true);
  });
});

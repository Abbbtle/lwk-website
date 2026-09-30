import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSession } from '../../test/sessions';
import type { Role } from './auth/session';
import { getDb } from './db';
import {
  forceSignOut,
  grantRole,
  listUsers,
  resetTwoStep,
  setAccountEnabled,
  setUserRole,
  UserAdminError,
} from './user-admin';

// Cognito stand-in: group membership kept in memory.
const groups = vi.hoisted(() => new Map<string, Set<string>>());
const cognito = vi.hoisted(() => ({
  addUserToGroup: vi.fn(async (id: string, role: string) => {
    groups.set(id, new Set([...(groups.get(id) ?? []), role]));
  }),
  removeUserFromGroup: vi.fn(async (id: string, role: string) => {
    groups.get(id)?.delete(role);
  }),
  listUserRoles: vi.fn(async (id: string) =>
    (['admin', 'instructor'] as const).filter((r) => groups.get(id)?.has(r)),
  ),
  listRoleMembers: vi.fn(async (role: string) =>
    [...groups.entries()].filter(([, set]) => set.has(role)).map(([id]) => id),
  ),
  getAccount: vi.fn(),
  disableAccount: vi.fn(),
  enableAccount: vi.fn(),
  signOutEverywhere: vi.fn(),
  resetTwoStepVerification: vi.fn(),
}));
vi.mock('./cognito', () => cognito);

afterAll(async () => {
  await getDb().$disconnect();
});

beforeEach(() => {
  groups.clear();
  Object.values(cognito).forEach((fn) => fn.mockClear());
});

async function person(roles: Role[] = [], name = 'Person') {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name,
      roles,
      lastSignInAt: new Date(),
    },
  });
  groups.set(user.id, new Set(roles));
  return { user, session: testSession(user, roles) };
}

const audited = (action: string, targetId: string) =>
  getDb().auditEvent.count({ where: { action, targetId } });

describe('roles', () => {
  it('grants a role in Cognito and applies it to current sessions at once', async () => {
    const admin = await person(['admin'], 'Admin');
    const { user } = await person();
    await setUserRole(admin.session, user.id, 'instructor', true);

    expect(cognito.addUserToGroup).toHaveBeenCalledWith(user.id, 'instructor');
    const stored = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.roles).toEqual(['instructor']);
    expect(stored.rolesChangedAt).not.toBeNull();
    expect(await audited('user.role.granted', user.id)).toBe(1);
  });

  it('removes roles, but never your own admin role or the last admin', async () => {
    const admin = await person(['admin'], 'Only Admin');
    const { user } = await person(['instructor']);
    await setUserRole(admin.session, user.id, 'instructor', false);
    expect((await getDb().user.findUniqueOrThrow({ where: { id: user.id } })).roles).toEqual([]);

    await expect(setUserRole(admin.session, admin.user.id, 'admin', false)).rejects.toMatchObject({
      code: 'self',
    });

    const other = await person(['admin'], 'Second Admin');
    groups.delete(admin.user.id); // Only "other" is an admin in Cognito now.
    await expect(setUserRole(admin.session, other.user.id, 'admin', false)).rejects.toMatchObject({
      code: 'last_admin',
    });
  });

  it('refuses people without the admin role', async () => {
    const instructor = await person(['instructor']);
    const { user } = await person();
    await expect(setUserRole(instructor.session, user.id, 'admin', true)).rejects.toBeInstanceOf(
      UserAdminError,
    );
    expect(cognito.addUserToGroup).not.toHaveBeenCalled();
  });

  it('grantRole (used by application approval) mirrors the Cognito groups', async () => {
    const { user } = await person();
    expect(await grantRole(user.id, 'instructor')).toEqual(['instructor']);
  });

  it('still records a granted role if Cognito cannot list the groups', async () => {
    const { user } = await person(['admin']);
    cognito.listUserRoles.mockRejectedValueOnce(new Error('AccessDenied'));
    expect(await grantRole(user.id, 'instructor')).toEqual(['admin', 'instructor']);
    expect((await getDb().user.findUniqueOrThrow({ where: { id: user.id } })).roles).toEqual([
      'admin',
      'instructor',
    ]);
  });
});

describe('account status', () => {
  it('disabling signs the user out everywhere and rejects their tokens', async () => {
    const admin = await person(['admin']);
    const { user } = await person();
    await setAccountEnabled(admin.session, user.id, false);
    expect(cognito.disableAccount).toHaveBeenCalledWith(user.id);
    const stored = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.disabledAt).not.toBeNull();
    expect(stored.sessionsValidAfter).not.toBeNull();

    await setAccountEnabled(admin.session, user.id, true);
    expect(cognito.enableAccount).toHaveBeenCalledWith(user.id);
    expect(
      (await getDb().user.findUniqueOrThrow({ where: { id: user.id } })).disabledAt,
    ).toBeNull();
    expect(await audited('user.disabled', user.id)).toBe(1);
    expect(await audited('user.enabled', user.id)).toBe(1);
  });

  it('never disables yourself or the last admin', async () => {
    const admin = await person(['admin']);
    await expect(setAccountEnabled(admin.session, admin.user.id, false)).rejects.toMatchObject({
      code: 'self',
    });
    const other = await person(['admin']);
    groups.delete(admin.user.id);
    await expect(setAccountEnabled(admin.session, other.user.id, false)).rejects.toMatchObject({
      code: 'last_admin',
    });
  });

  it('signs out everywhere and resets two-step verification for someone else', async () => {
    const admin = await person(['admin']);
    const { user } = await person();
    await getDb().user.update({ where: { id: user.id }, data: { mfaEnabled: true } });

    await forceSignOut(admin.session, user.id);
    expect(cognito.signOutEverywhere).toHaveBeenCalledWith(user.id);

    await resetTwoStep(admin.session, user.id);
    expect(cognito.resetTwoStepVerification).toHaveBeenCalledWith(user.id);
    const stored = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mfaEnabled).toBe(false);
    expect(stored.sessionsValidAfter).not.toBeNull();

    await expect(resetTwoStep(admin.session, admin.user.id)).rejects.toMatchObject({
      code: 'self',
    });
  });
});

describe('listUsers', () => {
  it('searches by name or email and filters by role', async () => {
    const tag = randomUUID().slice(0, 8);
    await person(['instructor'], `Teacher ${tag}`);
    await person([], `Learner ${tag}`);

    const all = await listUsers({ query: tag });
    expect(all.users.map((u) => u.name).sort()).toEqual([`Learner ${tag}`, `Teacher ${tag}`]);
    expect((await listUsers({ query: tag, filter: 'instructor' })).users).toHaveLength(1);
    expect((await listUsers({ query: `learner ${tag}` })).total).toBe(1);
    expect((await listUsers({ query: tag, filter: 'learner' })).users[0].name).toBe(
      `Learner ${tag}`,
    );
  });
});

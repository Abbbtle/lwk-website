import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { recordAudit } from './audit';
import { hasRole, ROLES, type Role, type Session } from './auth/session';
import * as cognito from './cognito';
import { getDb } from './db';
import { notify } from './notifications';

// Admin management of other people's accounts. Cognito is the source of truth for roles and
// whether an account can sign in; the database mirrors both so changes apply immediately
// (see applyAccountState in auth/session.ts).

export class UserAdminError extends Error {
  constructor(
    readonly code: 'forbidden' | 'not_found' | 'last_admin' | 'self',
    message: string,
  ) {
    super(message);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  instructor: 'Instructor',
  support: 'Support',
};

/** What to tell someone who has just been given a role. */
const ROLE_WELCOME: Record<Role, { body: string; href: string }> = {
  admin: {
    body: 'Turn on two-step verification in your account to use the admin tools.',
    href: '/admin',
  },
  instructor: { body: 'Open Instructor in your menu to start a course.', href: '/instructor' },
  support: {
    body: 'Turn on two-step verification in your account, then open the support inbox.',
    href: '/admin/support',
  },
};

function assertAdmin(session: Session) {
  if (!hasRole(session, 'admin')) throw new UserAdminError('forbidden', 'Admins only.');
}

const actorOf = (session: Session) => ({ userId: session.userId, name: session.name });

/** Enabled admins, counted in Cognito so an out-of-date database never allows a lockout. */
export async function countAdmins() {
  return (await cognito.listRoleMembers('admin')).length;
}

export const USER_FILTERS = [
  'all',
  'admin',
  'instructor',
  'support',
  'learner',
  'disabled',
] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

const PAGE_SIZE = 50;

export async function listUsers({
  query,
  filter = 'all',
  page = 1,
}: {
  query?: string;
  filter?: UserFilter;
  page?: number;
}) {
  const terms = (query ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  const where: Prisma.UserWhereInput = {
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    })),
    ...(filter === 'admin' && { roles: { has: 'admin' } }),
    ...(filter === 'instructor' && { roles: { has: 'instructor' } }),
    ...(filter === 'support' && { roles: { has: 'support' } }),
    ...(filter === 'learner' && { roles: { isEmpty: true } }),
    ...(filter === 'disabled' && { disabledAt: { not: null } }),
  };
  const db = getDb();
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        mfaEnabled: true,
        disabledAt: true,
        createdAt: true,
        lastSignInAt: true,
      },
    }),
    db.user.count({ where }),
  ]);
  return { users, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function countUsers() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, newThisWeek] = await Promise.all([
    getDb().user.count(),
    getDb().user.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { total, newThisWeek };
}

/**
 * One user with their live Cognito state. Refreshes the mirrored roles and two-step status if
 * they were changed outside the app (e.g. with the AWS CLI).
 */
export async function getUserDetail(session: Session, userId: string) {
  assertAdmin(session);
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      _count: { select: { enrollments: true, coursesTaught: true, lessonProgress: true } },
      enrollments: {
        orderBy: { lastActiveAt: 'desc' },
        take: 20,
        include: { course: { select: { title: true, slug: true } } },
      },
      coursesTaught: {
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true },
      },
    },
  });
  if (!user) return null;

  // Live state is a bonus: the page still works (with stored data) if Cognito cannot be asked.
  const [account, roles] = await Promise.all([
    cognito.getAccount(userId).catch((error) => {
      console.error('Reading the Cognito account failed', error);
      return null;
    }),
    cognito.listUserRoles(userId).catch(() => null),
  ]);
  const liveRoles = roles ?? (user.roles as Role[]);
  const drifted =
    (roles && [...liveRoles].sort().join() !== [...user.roles].sort().join()) ||
    (account && account.mfaEnabled !== user.mfaEnabled);
  if (drifted) {
    await db.user.update({
      where: { id: userId },
      data: { roles: liveRoles, ...(account && { mfaEnabled: account.mfaEnabled }) },
    });
  }
  return { ...user, roles: liveRoles, mfaEnabled: account?.mfaEnabled ?? user.mfaEnabled, account };
}

/**
 * Store the user's current Cognito roles and apply them to existing sessions immediately. If
 * Cognito cannot list them, `expected` (the stored roles with the change applied) is used.
 */
async function mirrorRoles(userId: string, expected: (stored: Role[]) => Role[]) {
  let roles: Role[];
  try {
    roles = await cognito.listUserRoles(userId);
  } catch (error) {
    console.error('Reading roles from Cognito failed', error);
    const stored = await getDb().user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    roles = expected((stored?.roles ?? []) as Role[]);
  }
  await getDb().user.update({
    where: { id: userId },
    data: { roles, rolesChangedAt: new Date() },
  });
  return roles;
}

/**
 * Give a role to a user. Also used when an instructor application is approved. The role works
 * straight away, without the user signing in again.
 */
export async function grantRole(userId: string, role: Role) {
  await cognito.addUserToGroup(userId, role);
  return mirrorRoles(userId, (stored) => ROLES.filter((r) => r === role || stored.includes(r)));
}

async function targetUser(userId: string) {
  const user = await getDb().user.findUnique({ where: { id: userId } });
  if (!user) throw new UserAdminError('not_found', 'User not found.');
  return user;
}

export async function setUserRole(
  session: Session,
  userId: string,
  role: Role,
  grant: boolean,
  ip?: string,
) {
  assertAdmin(session);
  const user = await targetUser(userId);
  if (!grant && role === 'admin') {
    if (userId === session.userId) {
      throw new UserAdminError('self', 'You cannot remove your own admin role.');
    }
    if ((await countAdmins()) <= 1) {
      throw new UserAdminError('last_admin', 'There must always be at least one admin.');
    }
  }
  if (grant) {
    await grantRole(userId, role);
  } else {
    await cognito.removeUserFromGroup(userId, role);
    await mirrorRoles(userId, (stored) => stored.filter((r) => r !== role));
  }
  await notify(
    userId,
    grant
      ? {
          kind: 'role.granted',
          title: `You now have the ${ROLE_LABELS[role]} role`,
          ...ROLE_WELCOME[role],
        }
      : { kind: 'role.revoked', title: `Your ${ROLE_LABELS[role]} role was removed` },
  );
  await recordAudit(actorOf(session), {
    action: grant ? 'user.role.granted' : 'user.role.revoked',
    target: { type: 'user', id: userId },
    summary: `${grant ? 'Gave' : 'Removed'} the ${ROLE_LABELS[role]} role ${grant ? 'to' : 'from'} ${user.name}`,
    details: { role },
    ip,
  });
}

export async function setAccountEnabled(
  session: Session,
  userId: string,
  enabled: boolean,
  ip?: string,
) {
  assertAdmin(session);
  const user = await targetUser(userId);
  if (userId === session.userId) {
    throw new UserAdminError('self', 'You cannot disable your own account.');
  }
  if (!enabled) {
    if (user.roles.includes('admin') && (await countAdmins()) <= 1) {
      throw new UserAdminError('last_admin', 'There must always be at least one admin.');
    }
    await cognito.disableAccount(userId);
    const now = new Date();
    await getDb().user.update({
      where: { id: userId },
      data: { disabledAt: now, sessionsValidAfter: now },
    });
  } else {
    await cognito.enableAccount(userId);
    await getDb().user.update({ where: { id: userId }, data: { disabledAt: null } });
  }
  await recordAudit(actorOf(session), {
    action: enabled ? 'user.enabled' : 'user.disabled',
    target: { type: 'user', id: userId },
    summary: `${enabled ? 'Re-enabled' : 'Disabled'} the account of ${user.name}`,
    ip,
  });
}

/** End every session of the user on every device. */
export async function forceSignOut(session: Session, userId: string, ip?: string) {
  assertAdmin(session);
  const user = await targetUser(userId);
  await cognito.signOutEverywhere(userId);
  await getDb().user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
  await recordAudit(actorOf(session), {
    action: 'user.signed_out',
    target: { type: 'user', id: userId },
    summary: `Signed ${user.name} out on all devices`,
    ip,
  });
}

/** For someone who lost their authenticator: they sign in with just a password again. */
export async function resetTwoStep(session: Session, userId: string, ip?: string) {
  assertAdmin(session);
  const user = await targetUser(userId);
  if (userId === session.userId) {
    throw new UserAdminError('self', 'Manage your own two-step verification in your account.');
  }
  await cognito.resetTwoStepVerification(userId);
  await getDb().user.update({ where: { id: userId }, data: { mfaEnabled: false } });
  await recordAudit(actorOf(session), {
    action: 'user.mfa.reset',
    target: { type: 'user', id: userId },
    summary: `Reset two-step verification for ${user.name}`,
    ip,
  });
}

export const ASSIGNABLE_ROLES = ROLES;

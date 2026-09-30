import 'server-only';
import { recordAudit } from './audit';
import type { Session } from './auth/session';
import { deleteOwnAccount, getOwnMfaEnabled, updateOwnName } from './cognito';
import { getDb } from './db';
import { countAdmins } from './user-admin';

// Self-service account management: profile, two-step status, sessions, export and deletion.

export class AccountError extends Error {
  constructor(
    readonly code: 'blocked' | 'reauthenticate',
    message: string,
  ) {
    super(message);
  }
}

/** Reject every token issued before now (the user signed out everywhere). */
export async function revokeSessions(userId: string) {
  await getDb().user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
}

/** Change the display name in Cognito (shown in tokens) and in the database. */
export async function updateProfileName(session: Session, accessToken: string, name: string) {
  await updateOwnName(accessToken, name);
  await getDb().user.update({ where: { id: session.userId }, data: { name } });
  await recordAudit(
    { userId: session.userId, name },
    {
      action: 'account.profile.updated',
      target: { type: 'user', id: session.userId },
      summary: `Changed display name from "${session.name}" to "${name}"`,
    },
  );
}

/**
 * Read the two-step status from Cognito after the browser changed it, and store it. Returns the
 * current status.
 */
export async function syncMfaStatus(session: Session, accessToken: string) {
  const enabled = await getOwnMfaEnabled(accessToken);
  const { mfaEnabled: before } = await getDb().user.update({
    where: { id: session.userId },
    data: { mfaEnabled: enabled },
    select: { mfaEnabled: true },
  });
  if (before !== enabled || session.mfaEnabled !== enabled) {
    await recordAudit(
      { userId: session.userId, name: session.name },
      {
        action: enabled ? 'account.mfa.enabled' : 'account.mfa.disabled',
        target: { type: 'user', id: session.userId },
        summary: enabled ? 'Turned on two-step verification' : 'Turned off two-step verification',
      },
    );
  }
  return enabled;
}

/** A copy of `value` without internal keys. */
function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
}

/** Everything stored about the user, for "Download my data". */
export async function exportAccountData(userId: string) {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      enrollments: { include: { course: { select: { title: true, slug: true } } } },
      lessonProgress: { include: { lesson: { select: { title: true } } } },
      instructorApplications: true,
      coursesTaught: { select: { title: true, slug: true, status: true, createdAt: true } },
    },
  });
  const [contactMessages, activity] = await Promise.all([
    db.contactMessage.findMany({ where: { email: { equals: user.email, mode: 'insensitive' } } }),
    db.auditEvent.findMany({
      where: { OR: [{ actorId: userId }, { targetType: 'user', targetId: userId }] },
      orderBy: { createdAt: 'asc' },
      select: { action: true, summary: true, actorName: true, createdAt: true },
    }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      twoStepVerification: user.mfaEnabled,
      memberSince: user.createdAt,
      lastSignIn: user.lastSignInAt,
    },
    enrollments: user.enrollments.map((e) => ({
      course: e.course.title,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      lastActiveAt: e.lastActiveAt,
    })),
    lessonProgress: user.lessonProgress.map((p) => ({
      lesson: p.lesson.title,
      lastPositionSeconds: p.lastPositionSeconds,
      completedAt: p.completedAt,
    })),
    instructorApplications: user.instructorApplications.map((a) =>
      omit(a, 'userId', 'reviewedById'),
    ),
    coursesTaught: user.coursesTaught,
    contactMessages: contactMessages.map((m) => omit(m, 'id')),
    accountActivity: activity,
  };
}

/** Why the account cannot be deleted by its owner right now, or null if it can. */
export async function deletionBlocker(session: Session): Promise<string | null> {
  const courses = await getDb().course.count({ where: { instructorId: session.userId } });
  if (courses > 0) {
    return 'You teach courses on Living With Krishna. Contact support so we can hand them over or remove them before your account is deleted.';
  }
  if (session.roles.includes('admin') || session.adminNeedsMfa) {
    // If the admins cannot be counted, assume this is the last one rather than risk a lockout.
    const admins = await countAdmins().catch((error) => {
      console.error('Counting admins failed', error);
      return 1;
    });
    if (admins <= 1) {
      return 'You are the only admin. Make someone else an admin before deleting your account.';
    }
  }
  return null;
}

/**
 * Delete the account for good: the Cognito user (with the fresh token proving the password was
 * just entered) and everything stored about them. Enrollments, progress and applications go
 * with the user row; audit entries keep the name but lose the link.
 */
export async function deleteAccount(session: Session, freshAccessToken: string) {
  const blocker = await deletionBlocker(session);
  if (blocker) throw new AccountError('blocked', blocker);

  await deleteOwnAccount(freshAccessToken);
  await recordAudit('system', {
    action: 'account.deleted',
    target: { type: 'user', id: session.userId },
    summary: `${session.name} deleted their account`,
  });
  try {
    const db = getDb();
    await db.contactMessage.deleteMany({
      where: { email: { equals: session.email, mode: 'insensitive' } },
    });
    await db.user.delete({ where: { id: session.userId } });
  } catch (error) {
    // The sign-in is already gone; the row must be removed by hand. Alerted via "failed".
    console.error('Account data removal failed', session.userId, error);
  }
}

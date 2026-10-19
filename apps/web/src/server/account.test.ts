import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSession } from '../../test/sessions';
import {
  AccountError,
  deleteAccount,
  deletionBlocker,
  exportAccountData,
  syncMfaStatus,
  updateProfileName,
} from './account';
import type { Role } from './auth/session';
import { getDb } from './db';

const cognito = vi.hoisted(() => ({
  updateOwnName: vi.fn(),
  getOwnMfaEnabled: vi.fn(async () => true),
  deleteOwnAccount: vi.fn(),
  listRoleMembers: vi.fn(async () => ['someone']),
}));
vi.mock('./cognito', () => cognito);

afterAll(async () => {
  await getDb().$disconnect();
});

beforeEach(() => {
  Object.values(cognito).forEach((fn) => fn.mockClear());
});

async function person(roles: Role[] = []) {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Account Holder',
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

describe('self-service account', () => {
  it('changes the display name in Cognito and the database', async () => {
    const session = await person();
    await updateProfileName(session, 'access-token', 'New Name');
    expect(cognito.updateOwnName).toHaveBeenCalledWith('access-token', 'New Name');
    expect((await getDb().user.findUniqueOrThrow({ where: { id: session.userId } })).name).toBe(
      'New Name',
    );
  });

  it('stores the two-step status read from Cognito and records the change', async () => {
    const session = { ...(await person()), mfaEnabled: false };
    expect(await syncMfaStatus(session, 'access-token')).toBe(true);
    expect(
      (await getDb().user.findUniqueOrThrow({ where: { id: session.userId } })).mfaEnabled,
    ).toBe(true);
    expect(
      await getDb().auditEvent.count({
        where: { action: 'account.mfa.enabled', targetId: session.userId },
      }),
    ).toBe(1);
  });

  it('exports what is stored, without internal keys', async () => {
    const session = await person();
    await getDb().contactMessage.create({
      data: {
        name: 'Account Holder',
        email: session.email.toUpperCase(),
        inquiryType: 'GENERAL',
        message: 'Hello',
      },
    });
    const data = await exportAccountData(session.userId);
    expect(data.profile).toMatchObject({ id: session.userId, email: session.email });
    expect(data.contactMessages).toHaveLength(1);
    expect(data.contactMessages[0]).not.toHaveProperty('id');
  });

  it('exports course access, memberships and seats, without provider codes', async () => {
    const [session, friend] = await Promise.all([person(), person()]);
    const course = await getDb().course.findUniqueOrThrow({ where: { slug: 'kirtan-basics' } });
    await getDb().courseAccess.create({
      data: { userId: session.userId, courseId: course.id, source: 'EARLY_ACCESS' },
    });
    const membership = (payerId: string, plan: 'FAMILY_YEARLY' | 'COMMUNITY') =>
      getDb().membership.create({
        data: {
          payerId,
          plan,
          region: 'south-africa',
          currency: 'ZAR',
          amountMinorUnits: 129900,
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2027-11-01T00:00:00Z'),
          providerCustomerCode: 'CUS_test',
        },
      });
    const family = await membership(session.userId, 'FAMILY_YEARLY');
    await getDb().membershipSeat.create({
      data: { membershipId: family.id, invitedEmail: 'family@example.org' },
    });
    const community = await membership(friend.userId, 'COMMUNITY');
    await getDb().membershipSeat.create({
      data: {
        membershipId: community.id,
        userId: session.userId,
        invitedEmail: session.email,
        acceptedAt: new Date(),
      },
    });

    const data = await exportAccountData(session.userId);
    expect(data.courseAccess).toEqual([
      {
        course: 'Kirtan Basics',
        source: 'EARLY_ACCESS',
        grantedAt: expect.any(Date),
        revokedAt: null,
      },
    ]);
    expect(data.memberships).toEqual([
      expect.objectContaining({
        plan: 'FAMILY_YEARLY',
        status: 'ACTIVE',
        amountMinorUnits: 129900,
        seats: [{ invitedEmail: 'family@example.org', acceptedAt: null }],
      }),
    ]);
    expect(data.memberships[0]).not.toHaveProperty('providerCustomerCode');
    expect(data.membershipSeats).toEqual([
      expect.objectContaining({ plan: 'COMMUNITY', invitedEmail: session.email }),
    ]);
  });
});

describe('deleting an account', () => {
  it('removes the Cognito user and everything stored, keeping an anonymous audit entry', async () => {
    const session = await person();
    await deleteAccount(session, 'fresh-token');
    expect(cognito.deleteOwnAccount).toHaveBeenCalledWith('fresh-token');
    expect(await getDb().user.findUnique({ where: { id: session.userId } })).toBeNull();
    const event = await getDb().auditEvent.findFirst({
      where: { action: 'account.deleted', targetId: session.userId },
    });
    expect(event).toMatchObject({ actorId: null, actorName: 'System' });
  });

  it('is blocked for instructors with courses and for the only admin', async () => {
    const teacher = await person(['instructor']);
    const category = await getDb().category.findFirstOrThrow();
    await getDb().course.create({
      data: {
        slug: `blocked-${randomUUID()}`,
        title: 'Taught course',
        subtitle: '',
        description: '',
        level: 'BEGINNER',
        instructorId: teacher.userId,
        instructorName: 'Account Holder',
        categoryId: category.id,
      },
    });
    expect(await deletionBlocker(teacher)).toMatch(/teach courses/);
    await expect(deleteAccount(teacher, 'token')).rejects.toBeInstanceOf(AccountError);
    expect(cognito.deleteOwnAccount).not.toHaveBeenCalled();

    const admin = await person(['admin']);
    expect(await deletionBlocker(admin)).toMatch(/only admin/);
    cognito.listRoleMembers.mockResolvedValueOnce(['a', 'b']);
    expect(await deletionBlocker(admin)).toBeNull();

    await getDb().course.deleteMany({ where: { instructorId: teacher.userId } });
  });
});

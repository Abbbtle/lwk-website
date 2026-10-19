import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseStatus, MembershipStatus } from '@/generated/prisma/client';
import {
  chargedPriceColumns,
  type CoursePricing,
  coursePricingColumns,
  familyPrice,
} from '@/lib/pricing';
import { testSession } from '../../test/sessions';
import {
  type AccessDecision,
  type AccessFacts,
  courseAccessFor,
  courseAccessForMany,
  decideCourseAccess,
  type Entitlements,
  grantCourseAccess,
  revokeCourseAccess,
} from './access';
import type { Role } from './auth/session';
import { getDb } from './db';
import type { MembershipStanding } from './memberships';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-02T12:00:00Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

/** Early access ended ten days ago. */
const ENDED = daysFromNow(-10);

const free: CoursePricing = { kind: 'free' };
const tier: CoursePricing = { kind: 'tier', tier: 3 };
const unpriced: CoursePricing = { kind: 'unpriced' };
const everyPricing = [free, tier, unpriced].map((pricing) => [pricing.kind, pricing] as const);

const learner = { isOwner: false, isAdmin: false };
const owner = { isOwner: true, isAdmin: false };
const admin = { isOwner: false, isAdmin: true };
const nothing: Entitlements = {
  enrolledAt: null,
  grants: [],
  memberships: [],
  seatMemberships: [],
};

const standing = (status: MembershipStatus, currentPeriodEnd: Date): MembershipStanding => ({
  status,
  currentPeriodEnd,
});

/** A signed-in learner opening a published, priced course after early access, unless the case says otherwise. */
function decide(facts: Partial<AccessFacts>): AccessDecision {
  return decideCourseAccess({
    pricing: tier,
    published: true,
    earlyAccessEndsAt: ENDED,
    viewer: learner,
    entitlements: nothing,
    now: NOW,
    ...facts,
  });
}

const PAYMENT_REQUIRED: AccessDecision = { kind: 'locked', reason: 'payment_required' };
const JOINED_EARLY: AccessDecision = { kind: 'open', reason: 'joined_in_early_access' };

describe('the access rule', () => {
  describe.each([
    ['while early access has no end', null],
    ['before early access ends', daysFromNow(10)],
    ['after early access', ENDED],
  ])('%s', (_phase, earlyAccessEndsAt) => {
    it.each(everyPricing)('gives signed-out visitors previews only (%s)', (_kind, pricing) => {
      expect(decide({ earlyAccessEndsAt, pricing, viewer: null })).toEqual({
        kind: 'locked',
        reason: 'signed_out',
      });
    });

    it.each(everyPricing)(
      'lets owners and admins manage, published or not (%s)',
      (_kind, pricing) => {
        for (const published of [true, false]) {
          expect(decide({ earlyAccessEndsAt, pricing, published, viewer: owner })).toEqual({
            kind: 'manage',
            role: 'owner',
          });
          expect(decide({ earlyAccessEndsAt, pricing, published, viewer: admin })).toEqual({
            kind: 'manage',
            role: 'admin',
          });
        }
      },
    );

    it('treats an unpublished course as not there for everyone else', () => {
      for (const viewer of [learner, null]) {
        expect(decide({ earlyAccessEndsAt, published: false, viewer })).toEqual({
          kind: 'locked',
          reason: 'unpublished',
        });
      }
    });

    it('opens free courses to everyone signed in', () => {
      expect(decide({ earlyAccessEndsAt, pricing: free })).toEqual({
        kind: 'open',
        reason: 'free',
      });
    });
  });

  describe('during early access', () => {
    it.each([
      ['a priced course', tier],
      ['an unpriced course', unpriced],
    ])('opens %s to everyone signed in, whatever they hold', (_case, pricing) => {
      const lapsed: Entitlements = {
        enrolledAt: null,
        grants: [{ source: 'PURCHASE', revoked: true }],
        memberships: [standing('EXPIRED', daysFromNow(-30))],
        seatMemberships: [],
      };
      for (const earlyAccessEndsAt of [null, daysFromNow(10)]) {
        expect(decide({ earlyAccessEndsAt, pricing, entitlements: lapsed })).toEqual({
          kind: 'open',
          reason: 'early_access',
        });
      }
    });

    it('ends exactly at its end date', () => {
      expect(decide({ earlyAccessEndsAt: NOW })).toEqual(PAYMENT_REQUIRED);
    });
  });

  describe('after early access', () => {
    it('needs a grant or a membership for a priced course', () => {
      expect(decide({})).toEqual(PAYMENT_REQUIRED);
    });

    it.each(everyPricing)(
      'keeps a course joined before the end open, whatever its price now (%s)',
      (_kind, pricing) => {
        const joined = { ...nothing, enrolledAt: daysFromNow(-200) };
        expect(decide({ pricing, entitlements: joined })).toEqual(
          pricing.kind === 'free' ? { kind: 'open', reason: 'free' } : JOINED_EARLY,
        );
      },
    );

    it('does not count an enrolment made at or after the end', () => {
      expect(decide({ entitlements: { ...nothing, enrolledAt: ENDED } })).toEqual(PAYMENT_REQUIRED);
      expect(decide({ entitlements: { ...nothing, enrolledAt: daysFromNow(-1) } })).toEqual(
        PAYMENT_REQUIRED,
      );
    });

    it.each(['PURCHASE', 'GIFT', 'ADMIN'] as const)(
      'opens a priced course with an unrevoked %s grant',
      (source) => {
        expect(
          decide({ entitlements: { ...nothing, grants: [{ source, revoked: false }] } }),
        ).toEqual({ kind: 'open', reason: 'grant', source });
      },
    );

    it('does not open it with a revoked grant, unless another grant or a membership counts', () => {
      const refunded = { source: 'PURCHASE', revoked: true } as const;
      expect(decide({ entitlements: { ...nothing, grants: [refunded] } })).toEqual(
        PAYMENT_REQUIRED,
      );
      expect(
        decide({
          entitlements: { ...nothing, grants: [refunded, { source: 'ADMIN', revoked: false }] },
        }),
      ).toEqual({ kind: 'open', reason: 'grant', source: 'ADMIN' });
      const member: Entitlements = {
        ...nothing,
        grants: [refunded],
        memberships: [standing('ACTIVE', daysFromNow(9))],
      };
      expect(decide({ entitlements: member })).toEqual({ kind: 'open', reason: 'membership' });
    });

    it('names the grant when there is a membership too, since the grant lasts', () => {
      const both: Entitlements = {
        ...nothing,
        grants: [{ source: 'GIFT', revoked: false }],
        memberships: [standing('ACTIVE', daysFromNow(9))],
      };
      expect(decide({ entitlements: both })).toEqual({
        kind: 'open',
        reason: 'grant',
        source: 'GIFT',
      });
    });

    it('opens a priced course with a membership or a seat that counts, own first', () => {
      const ended = standing('EXPIRED', daysFromNow(-30));
      const running = standing('ACTIVE', daysFromNow(30));
      const holding = (memberships: MembershipStanding[], seatMemberships: MembershipStanding[]) =>
        decide({ entitlements: { ...nothing, memberships, seatMemberships } });
      expect(holding([ended, running], [])).toEqual({ kind: 'open', reason: 'membership' });
      expect(holding([ended], [running])).toEqual({ kind: 'open', reason: 'seat' });
      expect(holding([running], [running])).toEqual({ kind: 'open', reason: 'membership' });
      expect(holding([ended], [ended])).toEqual(PAYMENT_REQUIRED);
    });

    it('keeps an unpriced course closed to all but its owner and admins, and early learners', () => {
      const holdsEverything: Entitlements = {
        enrolledAt: null,
        grants: [{ source: 'PURCHASE', revoked: false }],
        memberships: [standing('ACTIVE', daysFromNow(9))],
        seatMemberships: [standing('ACTIVE', daysFromNow(9))],
      };
      expect(decide({ pricing: unpriced, entitlements: holdsEverything })).toEqual({
        kind: 'locked',
        reason: 'unpriced',
      });
      expect(
        decide({
          pricing: unpriced,
          entitlements: { ...holdsEverything, enrolledAt: daysFromNow(-50) },
        }),
      ).toEqual(JOINED_EARLY);
    });
  });
});

// ---- Loading the facts and granting access, against the database ----------------------------

const SLUG_PREFIX = 'access-';
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

afterAll(async () => {
  await getDb().course.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await getDb().$disconnect();
});

async function person(roles: Role[] = []) {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Learner',
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

async function course(
  pricing: CoursePricing,
  {
    instructorId = null,
    status = 'PUBLISHED',
  }: { instructorId?: string | null; status?: CourseStatus } = {},
) {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `${SLUG_PREFIX}${randomUUID()}`,
      title: 'Access course',
      subtitle: '',
      description: '',
      level: 'BEGINNER',
      status,
      instructorName: 'T',
      instructorId,
      categoryId: category.id,
      ...coursePricingColumns(pricing),
    },
  });
}

function membershipFor(
  payerId: string,
  status: MembershipStatus,
  currentPeriodEnd: Date,
  terms: { trialEndsAt?: Date; cancelAtPeriodEnd?: boolean } = {},
) {
  return getDb().membership.create({
    data: {
      payerId,
      plan: 'FAMILY_YEARLY',
      ...chargedPriceColumns({
        region: 'south-africa',
        amount: familyPrice('south-africa').amount,
      }),
      status,
      currentPeriodEnd,
      ...terms,
    },
  });
}

describe('courseAccessFor', () => {
  beforeEach(() => {
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', inDays(-10).toISOString());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the grant for that course only, and sees when it is revoked', async () => {
    const viewer = await person();
    const [bought, other] = await Promise.all([course(tier), course(tier)]);
    await grantCourseAccess(getDb(), {
      userId: viewer.userId,
      courseId: bought.id,
      source: 'PURCHASE',
    });
    expect(await courseAccessFor(viewer, bought)).toEqual({
      kind: 'open',
      reason: 'grant',
      source: 'PURCHASE',
    });
    expect(await courseAccessFor(viewer, other)).toEqual(PAYMENT_REQUIRED);

    await revokeCourseAccess(getDb(), {
      userId: viewer.userId,
      courseId: bought.id,
      source: 'PURCHASE',
    });
    expect(await courseAccessFor(viewer, bought)).toEqual(PAYMENT_REQUIRED);
  });

  it('keeps a course open after a refund when an admin grant came before it', async () => {
    const viewer = await person();
    const paid = await course(tier);
    const grant = { userId: viewer.userId, courseId: paid.id };
    await grantCourseAccess(getDb(), { ...grant, source: 'ADMIN' });
    await grantCourseAccess(getDb(), { ...grant, source: 'PURCHASE' });
    await revokeCourseAccess(getDb(), { ...grant, source: 'PURCHASE' });
    expect(await courseAccessFor(viewer, paid)).toEqual({
      kind: 'open',
      reason: 'grant',
      source: 'ADMIN',
    });
  });

  it('reads the memberships the viewer pays for and the seats they accepted', async () => {
    const [payer, member, invited] = await Promise.all([person(), person(), person()]);
    const paid = await course(tier);
    const family = await membershipFor(payer.userId, 'ACTIVE', inDays(30));
    await getDb().membershipSeat.createMany({
      data: [
        {
          membershipId: family.id,
          userId: member.userId,
          invitedEmail: member.email,
          acceptedAt: new Date(),
        },
        // Not accepted yet, so nobody holds it: it opens nothing.
        { membershipId: family.id, invitedEmail: invited.email },
      ],
    });
    expect(await courseAccessFor(payer, paid)).toEqual({ kind: 'open', reason: 'membership' });
    expect(await courseAccessFor(member, paid)).toEqual({ kind: 'open', reason: 'seat' });
    expect(await courseAccessFor(invited, paid)).toEqual(PAYMENT_REQUIRED);

    await getDb().membership.update({ where: { id: family.id }, data: { status: 'EXPIRED' } });
    expect(await courseAccessFor(member, paid)).toEqual(PAYMENT_REQUIRED);
  });

  it('keeps a trial set to cancel open until the trial ends', async () => {
    const trialist = await person();
    const paid = await course(tier);
    const trial = await membershipFor(trialist.userId, 'TRIALING', inDays(3), {
      trialEndsAt: inDays(3),
      cancelAtPeriodEnd: true,
    });
    expect(await courseAccessFor(trialist, paid)).toEqual({ kind: 'open', reason: 'membership' });
    await getDb().membership.update({
      where: { id: trial.id },
      data: { currentPeriodEnd: inDays(-1), trialEndsAt: inDays(-1) },
    });
    expect(await courseAccessFor(trialist, paid)).toEqual(PAYMENT_REQUIRED);
  });

  it('keeps courses joined during early access open, also one priced after it was joined', async () => {
    const early = await person();
    const late = await person();
    const once = await course(free);
    await getDb().enrollment.createMany({
      data: [
        { userId: early.userId, courseId: once.id, enrolledAt: inDays(-30) },
        { userId: late.userId, courseId: once.id, enrolledAt: inDays(-1) },
      ],
    });
    await getDb().course.update({ where: { id: once.id }, data: coursePricingColumns(tier) });
    const priced = { ...once, ...coursePricingColumns(tier) };
    expect(await courseAccessFor(early, priced)).toEqual(JOINED_EARLY);
    expect(await courseAccessFor(late, priced)).toEqual(PAYMENT_REQUIRED);
  });

  it('keeps paid courses locked after early access, whatever the payments switch says', async () => {
    const viewer = await person();
    const paid = await course(tier);
    for (const enabled of ['false', 'true']) {
      vi.stubEnv('PAYMENTS_ENABLED', enabled);
      expect(await courseAccessFor(viewer, paid), enabled).toEqual(PAYMENT_REQUIRED);
    }
  });

  it('decides for owners, admins and visitors, and hides unpublished courses', async () => {
    const [teacher, adminViewer, viewer] = await Promise.all([
      person(['instructor']),
      person(['admin']),
      person(),
    ]);
    const own = await course(unpriced, { instructorId: teacher.userId });
    expect(await courseAccessFor(teacher, own)).toEqual({ kind: 'manage', role: 'owner' });
    expect(await courseAccessFor(adminViewer, own)).toEqual({ kind: 'manage', role: 'admin' });
    expect(await courseAccessFor(viewer, own)).toEqual({ kind: 'locked', reason: 'unpriced' });
    expect(await courseAccessFor(null, own)).toEqual({ kind: 'locked', reason: 'signed_out' });

    const draft = await course(tier, { instructorId: teacher.userId, status: 'DRAFT' });
    expect(await courseAccessFor(viewer, draft)).toEqual({ kind: 'locked', reason: 'unpublished' });
    expect(await courseAccessFor(teacher, draft)).toEqual({ kind: 'manage', role: 'owner' });
  });

  it('decides several courses in their order', async () => {
    const viewer = await person();
    const [bought, paid, gratis] = await Promise.all([course(tier), course(tier), course(free)]);
    await grantCourseAccess(getDb(), {
      userId: viewer.userId,
      courseId: bought.id,
      source: 'GIFT',
    });
    expect(await courseAccessForMany(viewer, [paid, gratis, bought])).toEqual([
      PAYMENT_REQUIRED,
      { kind: 'open', reason: 'free' },
      { kind: 'open', reason: 'grant', source: 'GIFT' },
    ]);
  });
});

describe('granting access', () => {
  async function rowsOf(userId: string, courseId: string) {
    return getDb().courseAccess.findMany({
      where: { userId, courseId },
      orderBy: { source: 'asc' },
      select: { source: true, grantedAt: true, revokedAt: true },
    });
  }

  it('keeps one grant per source, each revoked on its own', async () => {
    const viewer = await person();
    const paid = await course(tier);
    const grant = { userId: viewer.userId, courseId: paid.id };
    await grantCourseAccess(getDb(), { ...grant, source: 'GIFT' });
    await grantCourseAccess(getDb(), { ...grant, source: 'PURCHASE' });
    await grantCourseAccess(getDb(), { ...grant, source: 'PURCHASE' });
    expect(await rowsOf(viewer.userId, paid.id)).toEqual([
      expect.objectContaining({ source: 'PURCHASE', revokedAt: null }),
      expect.objectContaining({ source: 'GIFT', revokedAt: null }),
    ]);

    // A refunded purchase does not take away the gift.
    await revokeCourseAccess(getDb(), { ...grant, source: 'PURCHASE' });
    const [purchase, gift] = await rowsOf(viewer.userId, paid.id);
    expect(purchase.revokedAt).toBeInstanceOf(Date);
    expect(gift.revokedAt).toBeNull();
  });

  it('revives a revoked grant of the same source, keeping when it was first granted', async () => {
    const viewer = await person();
    const paid = await course(tier);
    const grant = { userId: viewer.userId, courseId: paid.id, source: 'PURCHASE' } as const;
    await grantCourseAccess(getDb(), grant);
    const [first] = await rowsOf(viewer.userId, paid.id);
    await revokeCourseAccess(getDb(), grant);
    await grantCourseAccess(getDb(), grant);
    expect(await rowsOf(viewer.userId, paid.id)).toEqual([
      { source: 'PURCHASE', grantedAt: first.grantedAt, revokedAt: null },
    ]);
  });
});

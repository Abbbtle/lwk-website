import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipStatus } from '@/generated/prisma/client';
import { type CoursePricing, coursePricingColumns } from '@/lib/pricing';
import { testSession } from '../../test/sessions';
import {
  type AccessDecision,
  type AccessFacts,
  courseAccessFor,
  courseAccessForEach,
  decideCourseAccess,
  earnsEarlyAccess,
  type Entitlements,
  type MembershipTerms,
  opensCourse,
} from './access';
import type { Role } from './auth/session';
import { getDb } from './db';

const NOW = new Date('2026-11-02T12:00:00Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

const OFF = { enabled: false, pastDueGraceDays: 3 };
const ON = { enabled: true, pastDueGraceDays: 3 };

const free: CoursePricing = { kind: 'free' };
const tier: CoursePricing = { kind: 'tier', tier: 3 };
const unpriced: CoursePricing = { kind: 'unpriced' };
const everyPricing = [free, tier, unpriced].map((pricing) => [pricing.kind, pricing] as const);

const learner = { isOwner: false, isAdmin: false };
const nothing: Entitlements = { grant: null, memberships: [], seatMemberships: [] };

const terms = (
  status: MembershipStatus,
  currentPeriodEnd: Date,
  trialEndsAt: Date | null = null,
): MembershipTerms => ({ status, currentPeriodEnd, trialEndsAt });

/** A learner opening a priced course with payments on, unless the case says otherwise. */
function decide(facts: Partial<AccessFacts>): AccessDecision {
  return decideCourseAccess({
    pricing: tier,
    payments: ON,
    viewer: learner,
    entitlements: nothing,
    now: NOW,
    ...facts,
  });
}

const PAYMENT_REQUIRED: AccessDecision = { kind: 'locked', reason: 'payment_required' };

describe('the access rule', () => {
  describe.each([
    ['off', OFF],
    ['on', ON],
  ])('with payments %s', (_state, payments) => {
    it.each(everyPricing)('gives signed-out visitors previews only (%s)', (_kind, pricing) => {
      expect(decide({ payments, pricing, viewer: null })).toEqual({
        kind: 'locked',
        reason: 'signed_out',
      });
    });

    it.each(everyPricing)('lets owners and admins manage (%s)', (_kind, pricing) => {
      expect(decide({ payments, pricing, viewer: { isOwner: true, isAdmin: false } })).toEqual({
        kind: 'manage',
        role: 'owner',
      });
      expect(decide({ payments, pricing, viewer: { isOwner: false, isAdmin: true } })).toEqual({
        kind: 'manage',
        role: 'admin',
      });
    });

    it('opens free courses to everyone signed in', () => {
      expect(decide({ payments, pricing: free })).toEqual({ kind: 'open', reason: 'free' });
    });
  });

  describe('with payments off', () => {
    it.each([
      ['a priced course', tier],
      ['an unpriced course', unpriced],
    ])('opens %s to everyone signed in, as early access', (_case, pricing) => {
      expect(decide({ payments: OFF, pricing })).toEqual({ kind: 'open', reason: 'early_access' });
    });

    it('does not look at grants or memberships', () => {
      const lapsed: Entitlements = {
        grant: { source: 'PURCHASE', revoked: true },
        memberships: [terms('EXPIRED', daysFromNow(-30))],
        seatMemberships: [],
      };
      expect(decide({ payments: OFF, entitlements: lapsed })).toEqual({
        kind: 'open',
        reason: 'early_access',
      });
    });
  });

  describe('with payments on', () => {
    it('needs a grant or a membership for a priced course', () => {
      expect(decide({})).toEqual(PAYMENT_REQUIRED);
    });

    it.each(['EARLY_ACCESS', 'PURCHASE', 'GIFT', 'ADMIN'] as const)(
      'opens a priced course with an unrevoked %s grant',
      (source) => {
        expect(decide({ entitlements: { ...nothing, grant: { source, revoked: false } } })).toEqual(
          { kind: 'open', reason: 'grant', source },
        );
      },
    );

    it('does not open it with a revoked grant, unless a membership counts', () => {
      const revoked = { source: 'PURCHASE', revoked: true } as const;
      expect(decide({ entitlements: { ...nothing, grant: revoked } })).toEqual(PAYMENT_REQUIRED);
      const member = { ...nothing, grant: revoked, memberships: [terms('ACTIVE', daysFromNow(9))] };
      expect(decide({ entitlements: member })).toEqual({ kind: 'open', reason: 'membership' });
    });

    it('names the grant when there is a membership too, since the grant lasts', () => {
      const both: Entitlements = {
        grant: { source: 'EARLY_ACCESS', revoked: false },
        memberships: [terms('ACTIVE', daysFromNow(9))],
        seatMemberships: [terms('ACTIVE', daysFromNow(9))],
      };
      expect(decide({ entitlements: both })).toEqual({
        kind: 'open',
        reason: 'grant',
        source: 'EARLY_ACCESS',
      });
    });

    it('keeps an unpriced course closed to everyone but staff, grants and memberships too', () => {
      const holdsEverything: Entitlements = {
        grant: { source: 'PURCHASE', revoked: false },
        memberships: [terms('ACTIVE', daysFromNow(9))],
        seatMemberships: [terms('ACTIVE', daysFromNow(9))],
      };
      expect(decide({ pricing: unpriced, entitlements: holdsEverything })).toEqual({
        kind: 'locked',
        reason: 'unpriced',
      });
    });

    // Each case runs as the viewer's own membership and as a seat on someone else's.
    it.each([
      ['a trial', true, terms('TRIALING', daysFromNow(5), daysFromNow(5))],
      ['a trial without an end date', true, terms('TRIALING', daysFromNow(5))],
      ['a trial that has ended', false, terms('TRIALING', daysFromNow(20), daysFromNow(-1))],
      ['a trial past its period', false, terms('TRIALING', daysFromNow(-1))],
      ['an active membership', true, terms('ACTIVE', daysFromNow(30))],
      ['an active membership whose period ends now', false, terms('ACTIVE', NOW)],
      ['an active membership past its period', false, terms('ACTIVE', daysFromNow(-1))],
      ['a cancelled membership within its period', true, terms('CANCELLED', daysFromNow(10))],
      ['a cancelled membership after its period', false, terms('CANCELLED', daysFromNow(-1))],
      ['a past-due membership within the grace days', true, terms('PAST_DUE', daysFromNow(-2))],
      ['a past-due membership as the grace days end', false, terms('PAST_DUE', daysFromNow(-3))],
      ['a past-due membership after the grace days', false, terms('PAST_DUE', daysFromNow(-4))],
      ['an expired membership', false, terms('EXPIRED', daysFromNow(30))],
    ])('%s counts: %s', (_case, counts, membership) => {
      const own = decide({ entitlements: { ...nothing, memberships: [membership] } });
      const seat = decide({ entitlements: { ...nothing, seatMemberships: [membership] } });
      expect(own).toEqual(counts ? { kind: 'open', reason: 'membership' } : PAYMENT_REQUIRED);
      expect(seat).toEqual(counts ? { kind: 'open', reason: 'seat' } : PAYMENT_REQUIRED);
    });

    it('uses whichever membership counts, an own membership before a seat', () => {
      const ended = terms('EXPIRED', daysFromNow(-30));
      const running = terms('ACTIVE', daysFromNow(30));
      expect(decide({ entitlements: { ...nothing, memberships: [ended, running] } })).toEqual({
        kind: 'open',
        reason: 'membership',
      });
      expect(
        decide({ entitlements: { ...nothing, memberships: [ended], seatMemberships: [running] } }),
      ).toEqual({ kind: 'open', reason: 'seat' });
      expect(
        decide({
          entitlements: { ...nothing, memberships: [running], seatMemberships: [running] },
        }),
      ).toEqual({ kind: 'open', reason: 'membership' });
    });
  });

  it('opens a course to manage or to study, never when locked', () => {
    expect(opensCourse({ kind: 'manage', role: 'admin' })).toBe(true);
    expect(opensCourse({ kind: 'open', reason: 'seat' })).toBe(true);
    expect(opensCourse(PAYMENT_REQUIRED)).toBe(false);
  });
});

describe('earnsEarlyAccess', () => {
  it('is earned by joining a course that is not free while payments are off', () => {
    expect(earnsEarlyAccess(tier, OFF)).toBe(true);
    expect(earnsEarlyAccess(unpriced, OFF)).toBe(true);
    expect(earnsEarlyAccess(free, OFF)).toBe(false);
    expect(earnsEarlyAccess(tier, ON)).toBe(false);
  });
});

// ---- The loader, against the database ---------------------------------------------------------

const SLUG_PREFIX = 'access-';

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

async function course(pricing: CoursePricing, instructorId: string | null = null) {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `${SLUG_PREFIX}${randomUUID()}`,
      title: 'Access course',
      subtitle: '',
      description: '',
      level: 'BEGINNER',
      status: 'PUBLISHED',
      instructorName: 'T',
      instructorId,
      categoryId: category.id,
      ...coursePricingColumns(pricing),
    },
  });
}

function membershipFor(payerId: string, status: MembershipStatus, currentPeriodEnd: Date) {
  return getDb().membership.create({
    data: {
      payerId,
      plan: 'FAMILY_YEARLY',
      region: 'south-africa',
      currency: 'ZAR',
      amountMinorUnits: 129900,
      status,
      currentPeriodEnd,
    },
  });
}

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

describe('courseAccessFor', () => {
  beforeEach(() => {
    vi.stubEnv('PAYMENTS_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().course.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await getDb().$disconnect();
  });

  it('reads the grant for that course only, and sees when it is revoked', async () => {
    const viewer = await person();
    const [bought, other] = await Promise.all([course(tier), course(tier)]);
    await getDb().courseAccess.create({
      data: { userId: viewer.userId, courseId: bought.id, source: 'PURCHASE' },
    });
    expect(await courseAccessFor(viewer, bought)).toEqual({
      kind: 'open',
      reason: 'grant',
      source: 'PURCHASE',
    });
    expect(await courseAccessFor(viewer, other)).toEqual(PAYMENT_REQUIRED);

    await getDb().courseAccess.updateMany({
      where: { userId: viewer.userId },
      data: { revokedAt: new Date() },
    });
    expect(await courseAccessFor(viewer, bought)).toEqual(PAYMENT_REQUIRED);
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
        // Not accepted yet: it opens nothing.
        { membershipId: family.id, userId: invited.userId, invitedEmail: invited.email },
      ],
    });
    expect(await courseAccessFor(payer, paid)).toEqual({ kind: 'open', reason: 'membership' });
    expect(await courseAccessFor(member, paid)).toEqual({ kind: 'open', reason: 'seat' });
    expect(await courseAccessFor(invited, paid)).toEqual(PAYMENT_REQUIRED);

    await getDb().membership.update({ where: { id: family.id }, data: { status: 'EXPIRED' } });
    expect(await courseAccessFor(member, paid)).toEqual(PAYMENT_REQUIRED);
  });

  it('decides for owners, admins, visitors and while payments are off', async () => {
    const [teacher, admin, viewer] = await Promise.all([
      person(['instructor']),
      person(['admin']),
      person(),
    ]);
    const own = await course(unpriced, teacher.userId);
    expect(await courseAccessFor(teacher, own)).toEqual({ kind: 'manage', role: 'owner' });
    expect(await courseAccessFor(admin, own)).toEqual({ kind: 'manage', role: 'admin' });
    expect(await courseAccessFor(viewer, own)).toEqual({ kind: 'locked', reason: 'unpriced' });
    expect(await courseAccessFor(null, own)).toEqual({ kind: 'locked', reason: 'signed_out' });

    vi.stubEnv('PAYMENTS_ENABLED', 'false');
    expect(await courseAccessFor(viewer, own)).toEqual({ kind: 'open', reason: 'early_access' });
  });

  it('decides several courses in their order', async () => {
    const viewer = await person();
    const [bought, paid, gratis] = await Promise.all([course(tier), course(tier), course(free)]);
    await getDb().courseAccess.create({
      data: { userId: viewer.userId, courseId: bought.id, source: 'GIFT' },
    });
    expect(await courseAccessForEach(viewer, [paid, gratis, bought])).toEqual([
      PAYMENT_REQUIRED,
      { kind: 'open', reason: 'free' },
      { kind: 'open', reason: 'grant', source: 'GIFT' },
    ]);
  });
});

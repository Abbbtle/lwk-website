import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { MembershipStatus } from '@/generated/prisma/client';
import {
  chargedPriceColumns,
  membershipLeadPrice,
  PAST_DUE_GRACE_DAYS,
  PRICE_REGIONS,
} from '@/lib/pricing';
import { getDb } from './db';
import { membershipOpensCourses } from './memberships';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-02T12:00:00Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

afterAll(async () => {
  await getDb().$disconnect();
});

describe('membershipOpensCourses', () => {
  it.each([
    ['a trial', true, 'TRIALING', 5],
    ['a trial that has ended', false, 'TRIALING', -1],
    ['an active membership', true, 'ACTIVE', 30],
    ['an active membership whose period ends now', false, 'ACTIVE', 0],
    ['an active membership past its period', false, 'ACTIVE', -1],
    ['a past-due membership within the grace days', true, 'PAST_DUE', 1 - PAST_DUE_GRACE_DAYS],
    ['a past-due membership as the grace days end', false, 'PAST_DUE', -PAST_DUE_GRACE_DAYS],
    ['a past-due membership after the grace days', false, 'PAST_DUE', -1 - PAST_DUE_GRACE_DAYS],
    ['an expired membership', false, 'EXPIRED', 30],
  ] as [string, boolean, MembershipStatus, number][])(
    '%s opens courses: %s',
    (_case, opens, status, periodEndsInDays) => {
      const standing = { status, currentPeriodEnd: daysFromNow(periodEndsInDays) };
      expect(membershipOpensCourses(standing, NOW)).toBe(opens);
    },
  );
});

describe('stored memberships', () => {
  async function payer() {
    return getDb().user.create({
      data: {
        id: randomUUID(),
        email: `${randomUUID()}@example.org`,
        name: 'Payer',
        lastSignInAt: new Date(),
      },
    });
  }

  function membership(
    payerId: string,
    price: { region: string; currency: string; amountMinorUnits: number },
    terms: { status?: MembershipStatus; trialEndsAt?: Date } = {},
  ) {
    return getDb().membership.create({
      data: {
        payerId,
        plan: 'MONTHLY',
        ...price,
        status: terms.status ?? 'ACTIVE',
        trialEndsAt: terms.trialEndsAt,
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
      },
    });
  }

  it("take only the price list's regions and currencies, in whole minor units", async () => {
    const { id } = await payer();
    for (const region of PRICE_REGIONS) {
      const price = chargedPriceColumns({ region, amount: membershipLeadPrice(region).amount });
      await expect(membership(id, price), region).resolves.toMatchObject(price);
    }
    await expect(
      membership(id, { region: 'atlantis', currency: 'USD', amountMinorUnits: 999 }),
    ).rejects.toThrow('memberships_region_check');
    await expect(
      membership(id, { region: 'india', currency: 'EUR', amountMinorUnits: 999 }),
    ).rejects.toThrow('memberships_currency_check');
    await expect(
      membership(id, { region: 'india', currency: 'INR', amountMinorUnits: -1 }),
    ).rejects.toThrow('memberships_amount_minor_units_check');
  });

  it('need a trial end while trialing', async () => {
    const { id } = await payer();
    const price = chargedPriceColumns({
      region: 'south-africa',
      amount: membershipLeadPrice('south-africa').amount,
    });
    await expect(membership(id, price, { status: 'TRIALING' })).rejects.toThrow(
      'memberships_trial_ends_at_check',
    );
    await expect(
      membership(id, price, { status: 'TRIALING', trialEndsAt: new Date() }),
    ).resolves.toMatchObject({ status: 'TRIALING' });
  });

  it('give a seat a user exactly when its invitation is accepted', async () => {
    const [owner, member] = await Promise.all([payer(), payer()]);
    const price = chargedPriceColumns({
      region: 'south-africa',
      amount: membershipLeadPrice('south-africa').amount,
    });
    const { id: membershipId } = await membership(owner.id, price);
    const seat = (data: { userId?: string; acceptedAt?: Date }) =>
      getDb().membershipSeat.create({
        data: { membershipId, invitedEmail: member.email, ...data },
      });
    await expect(seat({ userId: member.id })).rejects.toThrow('membership_seats_accepted_check');
    await expect(seat({ acceptedAt: new Date() })).rejects.toThrow(
      'membership_seats_accepted_check',
    );
    await expect(seat({})).resolves.toMatchObject({ userId: null, acceptedAt: null });
    await expect(seat({ userId: member.id, acceptedAt: new Date() })).resolves.toMatchObject({
      userId: member.id,
    });
  });
});

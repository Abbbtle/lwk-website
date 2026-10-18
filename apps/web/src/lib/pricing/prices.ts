import type { CourseTier } from './course-tiers';
import { formatMoney, type Money } from './money';
import { type PriceRegion, regionCurrency } from './regions';

// The price list: every price on the site comes from here. Amounts are minor units (cents, paise)
// in the region's currency and include VAT or GST. India and the rest of the world have yearly
// Membership only.

type RegionPrices = {
  /** Null where Membership is sold yearly only. */
  membershipMonthly: number | null;
  membershipYearly: number;
  /** A year of Membership at the founding-member price. */
  foundingMemberYearly: number;
  familyYearly: number;
  /** One seat for a year. */
  communitySeatYearly: number;
  courseTiers: Record<CourseTier, number>;
};

const PRICES: Record<PriceRegion, RegionPrices> = {
  'south-africa': {
    membershipMonthly: 9900,
    membershipYearly: 79900,
    foundingMemberYearly: 59900,
    familyYearly: 129900,
    communitySeatYearly: 49900,
    courseTiers: { 1: 12900, 2: 19900, 3: 29900, 4: 49900, 5: 79900 },
  },
  'high-income': {
    membershipMonthly: 999,
    membershipYearly: 7999,
    foundingMemberYearly: 5999,
    familyYearly: 12999,
    communitySeatYearly: 4999,
    courseTiers: { 1: 1299, 2: 1999, 3: 2999, 4: 4999, 5: 7999 },
  },
  india: {
    membershipMonthly: null,
    membershipYearly: 249900,
    foundingMemberYearly: 189900,
    familyYearly: 399900,
    communitySeatYearly: 149900,
    courseTiers: { 1: 39900, 2: 54900, 3: 79900, 4: 119900, 5: 179900 },
  },
  'rest-of-world': {
    membershipMonthly: null,
    membershipYearly: 2999,
    foundingMemberYearly: 2249,
    familyYearly: 4999,
    communitySeatYearly: 1999,
    courseTiers: { 1: 499, 2: 699, 3: 999, 4: 1499, 5: 2499 },
  },
};

// The rules that go with the prices.
/** Family covers up to this many people in one household. */
export const FAMILY_MAX_PEOPLE = 5;
/** Community plans, for temples, schools and study groups, start at this many seats. */
export const COMMUNITY_MIN_SEATS = 5;
/** The founding-member price is for everyone who joins during early access and the first members. */
export const FOUNDING_MEMBER_PLACES = 1000;

const MONTHS_IN_A_YEAR = 12;

export type BillingPeriod = 'month' | 'year';
/** A price paid every month or every year. */
export type RecurringPrice = { amount: Money; period: BillingPeriod };

function inRegion(region: PriceRegion, minorUnits: number): Money {
  return { currency: regionCurrency(region), minorUnits };
}

/** What a single course in the tier costs in the region. */
export function coursePrice(tier: CourseTier, region: PriceRegion): Money {
  return inRegion(region, PRICES[region].courseTiers[tier]);
}

/** The cheapest single course in the region ("courses start at R129"): tier 1. */
export function courseStartingPrice(region: PriceRegion): Money {
  return coursePrice(1, region);
}

/** Nothing to pay, in the region's currency: "R0". */
export function freePrice(region: PriceRegion): Money {
  return inRegion(region, 0);
}

/** Membership by the month (null where it is sold yearly only) and by the year. */
export function membershipPrices(region: PriceRegion): { monthly: Money | null; yearly: Money } {
  const { membershipMonthly, membershipYearly } = PRICES[region];
  return {
    monthly: membershipMonthly === null ? null : inRegion(region, membershipMonthly),
    yearly: inRegion(region, membershipYearly),
  };
}

/** The Membership price to lead with: monthly where it is offered, otherwise yearly. */
export function membershipHeadline(region: PriceRegion): RecurringPrice {
  const { monthly, yearly } = membershipPrices(region);
  return monthly ? { amount: monthly, period: 'month' } : { amount: yearly, period: 'year' };
}

/** A year of Membership at the founding-member price. */
export function foundingMemberPrice(region: PriceRegion): Money {
  return inRegion(region, PRICES[region].foundingMemberYearly);
}

/** A year of Family membership. */
export function familyPrice(region: PriceRegion): Money {
  return inRegion(region, PRICES[region].familyYearly);
}

/** One Community seat for a year. */
export function communitySeatPrice(region: PriceRegion): Money {
  return inRegion(region, PRICES[region].communitySeatYearly);
}

/** What paying yearly saves over 12 monthly payments, in whole percent: 33. */
export function yearlySavingPercent(monthly: Money, yearly: Money): number {
  if (monthly.currency !== yearly.currency) throw new Error('Prices are in different currencies.');
  return Math.round((1 - yearly.minorUnits / (monthly.minorUnits * MONTHS_IN_A_YEAR)) * 100);
}

/** A yearly price spread over 12 months, rounded up so it never understates the yearly price. */
export function monthlyEquivalent(yearly: Money): Money {
  return { currency: yearly.currency, minorUnits: Math.ceil(yearly.minorUnits / MONTHS_IN_A_YEAR) };
}

/** "R99 a month", "₹2,499 a year". */
export function formatRecurring({ amount, period }: RecurringPrice): string {
  return `${formatMoney(amount)} a ${period}`;
}

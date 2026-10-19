import type { CourseTier } from './course-tiers';
import { type Money, money } from './money';
import type { RecurringPrice } from './recurring';
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

/** Membership by the month (null where it is sold yearly only) and by the year. */
export type MembershipPrices = {
  readonly monthly: RecurringPrice | null;
  readonly yearly: RecurringPrice;
};

function inRegion(region: PriceRegion, minorUnits: number): Money {
  return money(regionCurrency(region), minorUnits);
}

function yearlyInRegion(region: PriceRegion, minorUnits: number): RecurringPrice {
  return { amount: inRegion(region, minorUnits), period: 'year' };
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

export function membershipPrices(region: PriceRegion): MembershipPrices {
  const { membershipMonthly, membershipYearly } = PRICES[region];
  return {
    monthly:
      membershipMonthly === null
        ? null
        : { amount: inRegion(region, membershipMonthly), period: 'month' },
    yearly: yearlyInRegion(region, membershipYearly),
  };
}

/** The Membership price to lead with: monthly where it is offered, otherwise yearly. */
export function membershipLeadPrice(region: PriceRegion): RecurringPrice {
  const { monthly, yearly } = membershipPrices(region);
  return monthly ?? yearly;
}

/** A year of Membership at the founding-member price. */
export function foundingMemberPrice(region: PriceRegion): RecurringPrice {
  return yearlyInRegion(region, PRICES[region].foundingMemberYearly);
}

/** A year of Family membership. */
export function familyPrice(region: PriceRegion): RecurringPrice {
  return yearlyInRegion(region, PRICES[region].familyYearly);
}

/** One Community seat for a year. */
export function communitySeatPrice(region: PriceRegion): RecurringPrice {
  return yearlyInRegion(region, PRICES[region].communitySeatYearly);
}

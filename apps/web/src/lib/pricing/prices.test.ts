import { describe, expect, it } from 'vitest';
import { COURSE_TIERS } from './course-tiers';
import { formatMoney, type Money } from './money';
import {
  communitySeatPrice,
  coursePrice,
  courseStartingPrice,
  familyPrice,
  formatRecurring,
  foundingMemberPrice,
  freePrice,
  membershipHeadline,
  membershipPrices,
  monthlyEquivalent,
  yearlySavingPercent,
} from './prices';
import { PRICE_REGIONS, type PriceRegion, regionCurrency } from './regions';

// The approved price list, as shown on the site (prices include VAT or GST).
const approved: Record<
  PriceRegion,
  {
    monthly: string | null;
    yearly: string;
    founding: string;
    family: string;
    seat: string;
    courses: string[];
  }
> = {
  'south-africa': {
    monthly: 'R99',
    yearly: 'R799',
    founding: 'R599',
    family: 'R1,299',
    seat: 'R499',
    courses: ['R129', 'R199', 'R299', 'R499', 'R799'],
  },
  'high-income': {
    monthly: '$9.99',
    yearly: '$79.99',
    founding: '$59.99',
    family: '$129.99',
    seat: '$49.99',
    courses: ['$12.99', '$19.99', '$29.99', '$49.99', '$79.99'],
  },
  india: {
    monthly: null,
    yearly: '₹2,499',
    founding: '₹1,899',
    family: '₹3,999',
    seat: '₹1,499',
    courses: ['₹399', '₹549', '₹799', '₹1,199', '₹1,799'],
  },
  'rest-of-world': {
    monthly: null,
    yearly: '$29.99',
    founding: '$22.49',
    family: '$49.99',
    seat: '$19.99',
    courses: ['$4.99', '$6.99', '$9.99', '$14.99', '$24.99'],
  },
};

function everyPrice(region: PriceRegion): Money[] {
  const { monthly, yearly } = membershipPrices(region);
  return [
    ...(monthly ? [monthly] : []),
    yearly,
    foundingMemberPrice(region),
    familyPrice(region),
    communitySeatPrice(region),
    ...COURSE_TIERS.map((tier) => coursePrice(tier, region)),
  ];
}

describe('price list', () => {
  it.each(PRICE_REGIONS)('has the approved prices for %s', (region) => {
    const shown = (money: Money | null) => (money ? formatMoney(money) : null);
    const membership = membershipPrices(region);
    expect({
      monthly: shown(membership.monthly),
      yearly: shown(membership.yearly),
      founding: shown(foundingMemberPrice(region)),
      family: shown(familyPrice(region)),
      seat: shown(communitySeatPrice(region)),
      courses: COURSE_TIERS.map((tier) => shown(coursePrice(tier, region))),
    }).toEqual(approved[region]);
  });

  it('prices each region in its own currency, in whole minor units', () => {
    for (const region of PRICE_REGIONS) {
      for (const price of everyPrice(region)) {
        expect(price.currency, region).toBe(regionCurrency(region));
        expect(Number.isInteger(price.minorUnits) && price.minorUnits > 0, region).toBe(true);
      }
    }
  });

  it('charges more for each higher course tier', () => {
    for (const region of PRICE_REGIONS) {
      const amounts = COURSE_TIERS.map((tier) => coursePrice(tier, region).minorUnits);
      expect(amounts, region).toEqual([...amounts].sort((a, b) => a - b));
      expect(new Set(amounts).size, region).toBe(amounts.length);
    }
  });
});

describe('membership', () => {
  it('leads with the monthly price, or the yearly one where it is sold yearly only', () => {
    expect(PRICE_REGIONS.map((region) => formatRecurring(membershipHeadline(region)))).toEqual([
      'R99 a month',
      '$9.99 a month',
      '₹2,499 a year',
      '$29.99 a year',
    ]);
  });

  it('saves a third when paid yearly', () => {
    for (const region of ['south-africa', 'high-income'] as const) {
      const { monthly, yearly } = membershipPrices(region);
      expect(yearlySavingPercent(monthly!, yearly), region).toBe(33);
    }
  });

  it('only compares prices in one currency', () => {
    const rand = membershipPrices('south-africa').yearly;
    const dollar = membershipPrices('high-income').monthly!;
    expect(() => yearlySavingPercent(dollar, rand)).toThrow('different currencies');
  });

  it('spreads a yearly price over 12 months, rounding up', () => {
    expect(formatMoney(monthlyEquivalent(membershipPrices('india').yearly))).toBe('₹208.25');
    // $29.99 / 12 is $2.499..., shown as $2.50 so the monthly figure never understates the price.
    expect(formatMoney(monthlyEquivalent(membershipPrices('rest-of-world').yearly))).toBe('$2.50');
  });
});

describe('single courses', () => {
  it('start at the tier 1 price', () => {
    expect(PRICE_REGIONS.map((region) => formatMoney(courseStartingPrice(region)))).toEqual([
      'R129',
      '$12.99',
      '₹399',
      '$4.99',
    ]);
  });

  it('cost nothing when free, in the local currency', () => {
    expect(PRICE_REGIONS.map((region) => formatMoney(freePrice(region)))).toEqual([
      'R0',
      '$0',
      '₹0',
      '$0',
    ]);
  });
});

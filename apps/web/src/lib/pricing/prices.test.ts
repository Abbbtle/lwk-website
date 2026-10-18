import { describe, expect, it } from 'vitest';
import { COURSE_TIERS } from './course-tiers';
import { formatMoney, type Money } from './money';
import {
  communitySeatPrice,
  coursePrice,
  courseStartingPrice,
  familyPrice,
  foundingMemberPrice,
  freePrice,
  membershipLeadPrice,
  membershipPrices,
} from './prices';
import { formatRecurring, type RecurringPrice } from './recurring';
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
    monthly: 'R99 a month',
    yearly: 'R799 a year',
    founding: 'R599 a year',
    family: 'R1,299 a year',
    seat: 'R499 a year',
    courses: ['R129', 'R199', 'R299', 'R499', 'R799'],
  },
  'high-income': {
    monthly: '$9.99 a month',
    yearly: '$79.99 a year',
    founding: '$59.99 a year',
    family: '$129.99 a year',
    seat: '$49.99 a year',
    courses: ['$12.99', '$19.99', '$29.99', '$49.99', '$79.99'],
  },
  india: {
    monthly: null,
    yearly: '₹2,499 a year',
    founding: '₹1,899 a year',
    family: '₹3,999 a year',
    seat: '₹1,499 a year',
    courses: ['₹399', '₹549', '₹799', '₹1,199', '₹1,799'],
  },
  'rest-of-world': {
    monthly: null,
    yearly: '$29.99 a year',
    founding: '$22.49 a year',
    family: '$49.99 a year',
    seat: '$19.99 a year',
    courses: ['$4.99', '$6.99', '$9.99', '$14.99', '$24.99'],
  },
};

function everyAmount(region: PriceRegion): Money[] {
  const { monthly, yearly } = membershipPrices(region);
  const recurring: RecurringPrice[] = [
    ...(monthly ? [monthly] : []),
    yearly,
    foundingMemberPrice(region),
    familyPrice(region),
    communitySeatPrice(region),
  ];
  return [
    ...recurring.map((price) => price.amount),
    ...COURSE_TIERS.map((tier) => coursePrice(tier, region)),
  ];
}

describe('price list', () => {
  it.each(PRICE_REGIONS)('has the approved prices for %s', (region) => {
    const { monthly, yearly } = membershipPrices(region);
    expect({
      monthly: monthly && formatRecurring(monthly),
      yearly: formatRecurring(yearly),
      founding: formatRecurring(foundingMemberPrice(region)),
      family: formatRecurring(familyPrice(region)),
      seat: formatRecurring(communitySeatPrice(region)),
      courses: COURSE_TIERS.map((tier) => formatMoney(coursePrice(tier, region))),
    }).toEqual(approved[region]);
  });

  it('prices each region in its own currency, in whole minor units', () => {
    for (const region of PRICE_REGIONS) {
      for (const amount of everyAmount(region)) {
        expect(amount.currency, region).toBe(regionCurrency(region));
        expect(Number.isSafeInteger(amount.minorUnits) && amount.minorUnits > 0, region).toBe(true);
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
    expect(PRICE_REGIONS.map((region) => formatRecurring(membershipLeadPrice(region)))).toEqual([
      'R99 a month',
      '$9.99 a month',
      '₹2,499 a year',
      '$29.99 a year',
    ]);
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

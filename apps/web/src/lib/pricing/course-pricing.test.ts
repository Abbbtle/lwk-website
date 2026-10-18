import { describe, expect, it } from 'vitest';
import {
  type CoursePricing,
  courseListPrice,
  coursePricing,
  coursePricingColumns,
} from './course-pricing';
import { formatMoney } from './money';

describe('coursePricing', () => {
  it.each([
    ['free', { isFree: true, priceTier: null }, { kind: 'free' }],
    ['a tier', { isFree: false, priceTier: 3 }, { kind: 'tier', tier: 3 }],
    ['unpriced', { isFree: false, priceTier: null }, { kind: 'unpriced' }],
    ['free with a leftover tier', { isFree: true, priceTier: 2 }, { kind: 'free' }],
    ['an invalid tier', { isFree: false, priceTier: 9 }, { kind: 'unpriced' }],
  ])('reads %s from the stored columns', (_case, columns, pricing) => {
    expect(coursePricing(columns)).toEqual(pricing);
  });
});

describe('coursePricingColumns', () => {
  it('stores each kind so that it reads back the same', () => {
    const kinds: CoursePricing[] = [
      { kind: 'free' },
      { kind: 'tier', tier: 4 },
      { kind: 'unpriced' },
    ];
    expect(kinds.map(coursePricingColumns)).toEqual([
      { isFree: true, priceTier: null },
      { isFree: false, priceTier: 4 },
      { isFree: false, priceTier: null },
    ]);
    for (const pricing of kinds) {
      expect(coursePricing(coursePricingColumns(pricing))).toEqual(pricing);
    }
  });
});

describe('courseListPrice', () => {
  it('is nothing when free, the tier price, or unknown while unpriced', () => {
    const shown = (pricing: CoursePricing) => {
      const price = courseListPrice(pricing, 'india');
      return price && formatMoney(price);
    };
    expect(shown({ kind: 'free' })).toBe('₹0');
    expect(shown({ kind: 'tier', tier: 2 })).toBe('₹549');
    expect(shown({ kind: 'unpriced' })).toBeNull();
  });
});

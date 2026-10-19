import { describe, expect, it } from 'vitest';
import type { CoursePricing } from '@/lib/pricing';
import { courseDetailsSchema, priceFieldValue, priceOptions } from './course';

const details = {
  title: 'Japa Foundations',
  categorySlug: 'kirtan',
  level: 'BEGINNER',
  instructorName: 'Japa Teacher',
};

const pricingFrom = (fields: Record<string, string>) =>
  courseDetailsSchema.safeParse({ ...details, ...fields });

describe('course price field', () => {
  it('offers Free and each tier with its main regional prices', () => {
    expect(priceOptions.map((option) => option.value)).toEqual(['free', '1', '2', '3', '4', '5']);
    expect(priceOptions[2].label).toBe('Tier 2 · Standard · R199 · $19.99 · ₹549');
  });

  it('reads free, a tier, or unpriced', () => {
    expect(pricingFrom({ price: 'free' }).data?.price).toEqual({ kind: 'free' });
    expect(pricingFrom({ price: '3' }).data?.price).toEqual({ kind: 'tier', tier: 3 });
    expect(pricingFrom({ price: '' }).data?.price).toEqual({ kind: 'unpriced' });
    // Browsers leave the field out while the placeholder is selected.
    expect(pricingFrom({}).data?.price).toEqual({ kind: 'unpriced' });
  });

  it('rejects anything else', () => {
    for (const price of ['0', '6', '2.0', 'paid']) {
      expect(pricingFrom({ price }).error?.issues[0], price).toMatchObject({
        path: ['price'],
        message: 'Choose a price.',
      });
    }
  });

  it('shows the saved pricing again', () => {
    const kinds: CoursePricing[] = [
      { kind: 'free' },
      { kind: 'tier', tier: 4 },
      { kind: 'unpriced' },
    ];
    expect(kinds.map(priceFieldValue)).toEqual(['free', '4', '']);
    for (const pricing of kinds) {
      expect(pricingFrom({ price: priceFieldValue(pricing) }).data?.price).toEqual(pricing);
    }
  });
});

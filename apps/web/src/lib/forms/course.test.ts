import { describe, expect, it } from 'vitest';
import { courseDetailsSchema, priceFieldValue, priceOptions } from './course';

const details = {
  title: 'Japa Foundations',
  categorySlug: 'kirtan',
  level: 'BEGINNER',
  instructorName: 'Japa Teacher',
};

const priceFrom = (fields: Record<string, string>) =>
  courseDetailsSchema.safeParse({ ...details, ...fields });

describe('course price field', () => {
  it('offers Free and each tier with its main regional prices', () => {
    expect(priceOptions.map((option) => option.value)).toEqual(['free', '1', '2', '3', '4', '5']);
    expect(priceOptions[2].label).toBe('Tier 2 · Standard · R199 · $19.99 · ₹549');
  });

  it('reads free, a tier, or no choice yet', () => {
    expect(priceFrom({ price: 'free' }).data?.price).toBe('free');
    expect(priceFrom({ price: '3' }).data?.price).toBe(3);
    expect(priceFrom({ price: '' }).data?.price).toBeNull();
    // Browsers leave the field out while the placeholder is selected.
    expect(priceFrom({}).data?.price).toBeNull();
  });

  it('rejects anything else', () => {
    for (const price of ['0', '6', '2.0', 'paid']) {
      expect(priceFrom({ price }).error?.issues[0], price).toMatchObject({
        path: ['price'],
        message: 'Choose a price.',
      });
    }
  });

  it('shows the saved choice again', () => {
    expect(priceFieldValue({ isFree: true, priceTier: null })).toBe('free');
    expect(priceFieldValue({ isFree: false, priceTier: 4 })).toBe('4');
    expect(priceFieldValue({ isFree: false, priceTier: null })).toBe('');
    for (const option of priceOptions) {
      const price = priceFrom({ price: option.value }).data?.price ?? null;
      const saved =
        price === 'free' ? { isFree: true, priceTier: null } : { isFree: false, priceTier: price };
      expect(priceFieldValue(saved)).toBe(option.value);
    }
  });
});

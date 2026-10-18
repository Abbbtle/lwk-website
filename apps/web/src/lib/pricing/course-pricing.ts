import { type CourseTier, isCourseTier } from './course-tiers';
import type { Money } from './money';
import { coursePrice, freePrice } from './prices';
import type { PriceRegion } from './regions';

/**
 * What a course costs: free for everyone, one of the price tiers, or "unpriced" (a paid course
 * whose instructor has not chosen a tier yet; only drafts may stay unpriced).
 */
export type CoursePricing =
  | { readonly kind: 'free' }
  | { readonly kind: 'tier'; readonly tier: CourseTier }
  | { readonly kind: 'unpriced' };

/** How a course's pricing is stored: the `is_free` and `price_tier` columns. */
export type CoursePricingColumns = { isFree: boolean; priceTier: CourseTier | null };

/**
 * A course's pricing from its stored columns. Free wins over a tier left behind (an older release
 * can make a course free without clearing it); a missing or invalid tier means unpriced.
 */
export function coursePricing(columns: {
  isFree: boolean;
  priceTier: number | null;
}): CoursePricing {
  if (columns.isFree) return { kind: 'free' };
  return isCourseTier(columns.priceTier)
    ? { kind: 'tier', tier: columns.priceTier }
    : { kind: 'unpriced' };
}

/** The columns that store a course's pricing; every write goes through this. */
export function coursePricingColumns(pricing: CoursePricing): CoursePricingColumns {
  switch (pricing.kind) {
    case 'free':
      return { isFree: true, priceTier: null };
    case 'tier':
      return { isFree: false, priceTier: pricing.tier };
    case 'unpriced':
      return { isFree: false, priceTier: null };
  }
}

/**
 * What the course costs in the region once paid plans open: nothing when it is free, its tier's
 * price, or null while it is unpriced.
 */
export function courseListPrice(pricing: CoursePricing, region: PriceRegion): Money | null {
  switch (pricing.kind) {
    case 'free':
      return freePrice(region);
    case 'tier':
      return coursePrice(pricing.tier, region);
    case 'unpriced':
      return null;
  }
}

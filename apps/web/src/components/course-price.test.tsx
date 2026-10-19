import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoursePricing } from '@/lib/pricing';
import type { SalesPhase } from '@/server/early-access';
import { CoursePrice } from './course-price';

/** The price box's text on a course page, without markup. */
function shown(pricing: CoursePricing, phase: SalesPhase, variant: 'card' | 'page' = 'page') {
  const html = renderToStaticMarkup(
    <CoursePrice pricing={pricing} region="south-africa" phase={phase} variant={variant} />,
  );
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tier: CoursePricing = { kind: 'tier', tier: 3 };

describe('CoursePrice', () => {
  it('strikes through the price during early access, when every course is free', () => {
    expect(shown(tier, 'early_access')).toBe('R299 Free Free during early access.');
    expect(shown({ kind: 'unpriced' }, 'early_access', 'card')).toBe('Free');
  });

  it('shows prices as they are once early access has ended', () => {
    expect(shown(tier, 'paid')).toBe('R299 Yours to keep, or included in Membership.');
    expect(shown({ kind: 'unpriced' }, 'paid', 'card')).toBe('Not on sale yet');
  });

  it('keeps free courses free in either phase', () => {
    for (const phase of ['early_access', 'paid'] as const) {
      expect(shown({ kind: 'free' }, phase)).toBe('Free This course is free for everyone.');
    }
  });
});

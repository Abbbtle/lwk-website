import type { ReactElement } from 'react';
import { type CoursePricing, coursePrice, formatMoney, type PriceRegion } from '@/lib/pricing';

// What a course costs, as shown while every course is free to join during early access: free
// courses say Free, a priced course shows its local price struck through and then Free, and a
// course without a price yet says Free on cards ("Free during early access" on its page).

export function CoursePrice({
  pricing,
  region,
  variant,
}: {
  pricing: CoursePricing;
  /** Whose prices to show (see viewerPriceRegion). */
  region: PriceRegion;
  /** One line on a course card, or the course page's price box with a note. */
  variant: 'card' | 'page';
}): ReactElement | false {
  const Amount = variant === 'card' ? 'span' : 'p';
  const amountClass = variant === 'card' ? 'text-lg font-bold' : 'text-3xl font-extrabold';
  const note = (text: string) =>
    variant === 'page' && <p className="text-sm text-gray-600">{text}</p>;

  switch (pricing.kind) {
    case 'free':
      return (
        <>
          <Amount className={amountClass}>Free</Amount>
          {note('This course is free for everyone.')}
        </>
      );
    case 'tier':
      return (
        <>
          <Amount className={amountClass}>
            <span className="text-gray-500 line-through">
              {formatMoney(coursePrice(pricing.tier, region))}
            </span>{' '}
            Free
          </Amount>
          {note('Free during early access.')}
        </>
      );
    case 'unpriced':
      return variant === 'card' ? (
        <Amount className={amountClass}>Free</Amount>
      ) : (
        note('Free during early access.')
      );
  }
}

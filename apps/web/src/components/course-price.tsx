import type { ReactElement } from 'react';
import { type CoursePricing, coursePrice, formatMoney, type PriceRegion } from '@/lib/pricing';
import type { SalesPhase } from '@/server/early-access';

// What a course costs. During early access every course is free to join: free courses say Free, a
// priced course shows its local price struck through and then Free, and a course without a price
// yet says Free on cards ("Free during early access" on its page). After early access prices show
// as they are: Free, the local price, or "Not on sale yet" for a course without a price.

export function CoursePrice({
  pricing,
  region,
  phase,
  variant,
}: {
  pricing: CoursePricing;
  /** Whose prices to show (see viewerPriceRegion). */
  region: PriceRegion;
  /** Early access or paid plans (see currentSalesPhase). */
  phase: SalesPhase;
  /** One line on a course card, or the course page's price box with a note. */
  variant: 'card' | 'page';
}): ReactElement | false {
  const Amount = variant === 'card' ? 'span' : 'p';
  const amountClass = variant === 'card' ? 'text-lg font-bold' : 'text-3xl font-extrabold';
  const note = (text: string) =>
    variant === 'page' && <p className="text-sm text-gray-600">{text}</p>;
  const earlyAccess = phase === 'early_access';

  switch (pricing.kind) {
    case 'free':
      return (
        <>
          <Amount className={amountClass}>Free</Amount>
          {note('This course is free for everyone.')}
        </>
      );
    case 'tier': {
      const price = formatMoney(coursePrice(pricing.tier, region));
      return earlyAccess ? (
        <>
          <Amount className={amountClass}>
            <span className="text-gray-500 line-through">{price}</span> Free
          </Amount>
          {note('Free during early access.')}
        </>
      ) : (
        <>
          <Amount className={amountClass}>{price}</Amount>
          {note('Yours to keep, or included in Membership.')}
        </>
      );
    }
    case 'unpriced':
      if (!earlyAccess) {
        return variant === 'card' ? (
          <Amount className="text-sm text-gray-600">Not on sale yet</Amount>
        ) : (
          note('Not on sale yet.')
        );
      }
      return variant === 'card' ? (
        <Amount className={amountClass}>Free</Amount>
      ) : (
        note('Free during early access.')
      );
  }
}

// Early access is the site's first phase: every course is open to everyone signed in, at no cost.
// It ends once, at EARLY_ACCESS_ENDS_AT below, and paid plans run from then on; courses joined
// before the end stay open to those learners for good (src/server/access.ts). Pure code, safe in
// client components. The server reads the end through src/server/early-access.ts.

export type SalesPhase = 'early_access' | 'paid';

/** The phase now, and when early access ends (null while no end is set). */
export type SalesMoment = {
  readonly phase: SalesPhase;
  readonly earlyAccessEndsAt: Date | null;
};

declare const zoned: unique symbol;

/** A moment written with its time zone, so it does not move with a server's clock zone. */
export type ZonedDateTime = Date & { readonly [zoned]: true };

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A moment from an ISO date-time with its time zone, such as 2027-03-01T00:00:00+02:00. Throws a
 * RangeError for anything else.
 */
export function isoDateTime(value: string): ZonedDateTime {
  const date = new Date(value);
  if (!ISO_DATE_TIME.test(value) || Number.isNaN(date.getTime())) {
    throw new RangeError(
      `Expected an ISO date-time with a time zone, such as 2027-03-01T00:00:00+02:00, but got "${value}".`,
    );
  }
  return date as ZonedDateTime;
}

/**
 * When early access ends: null until the pull request that announces the end sets it, at least
 * PAID_PLANS_NOTICE_DAYS ahead, for example to isoDateTime('2027-03-01T00:00:00+02:00'). Once
 * that moment has passed, never remove or move it: it decides who joined during early access.
 */
export const EARLY_ACCESS_ENDS_AT: ZonedDateTime | null = null;

/** The phase at `now`: early access until its end, if one is set, then paid plans for good. */
export function salesPhase(endsAt: Date | null, now: Date): SalesPhase {
  return endsAt !== null && now.getTime() >= endsAt.getTime() ? 'paid' : 'early_access';
}

/** "1 March 2027": the end date as it falls in South Africa, the home market. */
export function formatEarlyAccessEnd(endsAt: Date): string {
  return endsAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
}

import 'server-only';

// Early access is the site's first phase: every course is open to everyone signed in, at no cost.
// It ends once, at EARLY_ACCESS_ENDS_AT (Parameter Store /lwk/<stage>/web/* in AWS, set at
// launch), and paid plans run from then on. Courses joined before the end stay open to those
// learners for good (src/server/access.ts). Checkout has its own switch, PAYMENTS_ENABLED, which
// never changes who may open a course.

export type SalesPhase = 'early_access' | 'paid';

/** The phase at `now`: early access until its end, if one is set, then paid plans for good. */
export function salesPhase(endsAt: Date | null, now: Date): SalesPhase {
  return endsAt !== null && now.getTime() >= endsAt.getTime() ? 'paid' : 'early_access';
}

// A full date-time with its time zone, so the end does not move with the server's clock zone.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * When early access ends, from EARLY_ACCESS_ENDS_AT, or null while no end is set. A value that is
 * not an ISO date-time with a time zone stops with an error rather than guessing the phase.
 */
export function earlyAccessEndsAt(): Date | null {
  const value = process.env.EARLY_ACCESS_ENDS_AT?.trim();
  if (!value) return null;
  const endsAt = new Date(value);
  if (!ISO_DATE_TIME.test(value) || Number.isNaN(endsAt.getTime())) {
    throw new Error(
      `EARLY_ACCESS_ENDS_AT must be an ISO date-time with a time zone, such as 2027-03-01T00:00:00+02:00, not "${value}".`,
    );
  }
  return endsAt;
}

/** The phase for this request. Pages read it once and pass it down. */
export function currentSalesPhase(): SalesPhase {
  return salesPhase(earlyAccessEndsAt(), new Date());
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

import 'server-only';
import {
  EARLY_ACCESS_ENDS_AT,
  isoDateTime,
  type SalesMoment,
  salesPhase,
  type SalesPhase,
} from '@/lib/early-access';

// The end of early access as this server sees it: the reviewed constant in src/lib/early-access.ts.
// Outside production, EARLY_ACCESS_ENDS_AT in the environment may stand in for it, for tests and
// local checks, as PRICE_COUNTRY stands in for the visitor's country.

/**
 * Outside production, EARLY_ACCESS_ENDS_AT (an ISO date-time with its time zone) stands in for
 * the constant; null when it is not set. A malformed value stops with an error.
 */
export function standInEarlyAccessEnd(env: {
  NODE_ENV?: string;
  EARLY_ACCESS_ENDS_AT?: string;
}): Date | null {
  if (env.NODE_ENV === 'production') return null;
  const value = env.EARLY_ACCESS_ENDS_AT?.trim();
  if (!value) return null;
  try {
    return isoDateTime(value);
  } catch (error) {
    throw new Error(`EARLY_ACCESS_ENDS_AT: ${(error as Error).message}`, { cause: error });
  }
}

/** When early access ends, or null while no end is set. */
export function earlyAccessEndsAt(): Date | null {
  return standInEarlyAccessEnd(process.env) ?? EARLY_ACCESS_ENDS_AT;
}

/** The phase and the end of early access for this request. Pages read it once and pass it down. */
export function currentSalesMoment(): SalesMoment {
  const endsAt = earlyAccessEndsAt();
  return { phase: salesPhase(endsAt, new Date()), earlyAccessEndsAt: endsAt };
}

/** The phase for this request. */
export function currentSalesPhase(): SalesPhase {
  return currentSalesMoment().phase;
}

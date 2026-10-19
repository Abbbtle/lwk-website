import 'server-only';
import type { MembershipStatus, Prisma } from '@/generated/prisma/client';
import { PAST_DUE_GRACE_DAYS } from '@/lib/pricing';

// Memberships: the paid plans that open every priced course (Phase 14). Starting a trial,
// renewing, a failed renewal, cancelling and expiring, and a query form of the rule below for the
// hourly jobs, come with Phase 14c.

/** What decides whether a membership opens courses. */
export type MembershipStanding = {
  readonly status: MembershipStatus;
  /** The end of what is paid for, or of the trial while trialing. */
  readonly currentPeriodEnd: Date;
};

export const membershipStandingSelect = {
  status: true,
  currentPeriodEnd: true,
} satisfies Prisma.MembershipSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a membership opens priced courses at `now`: while trialing or active until its period
 * ends (also when it is set to cancel then), and when a renewal failed, until the grace days after
 * the period end are over. An expired membership opens nothing.
 */
export function membershipOpensCourses(standing: MembershipStanding, now: Date): boolean {
  const runsPast = (end: Date) => end.getTime() > now.getTime();
  switch (standing.status) {
    case 'TRIALING':
    case 'ACTIVE':
      return runsPast(standing.currentPeriodEnd);
    case 'PAST_DUE':
      return runsPast(new Date(standing.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS));
    case 'EXPIRED':
      return false;
  }
}

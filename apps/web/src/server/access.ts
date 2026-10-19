import 'server-only';
import type { AccessSource, MembershipStatus, Prisma } from '@/generated/prisma/client';
import { type CoursePricing, coursePricing } from '@/lib/pricing';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';
import { type PaymentsConfig, paymentsConfig } from './payments/config';

// Who may open a course: the one rule behind the player, progress, enrolment, My Learning and the
// AI tools. Owners and admins manage every course, and signed-out visitors get free previews only.
// While payments are off, every course is open to everyone signed in (early access). Once they are
// on, free courses stay open to everyone signed in, priced courses open with a grant or a
// membership that counts, and courses without a price open to staff only.

/** Whether someone may open a course's lessons, and why, so callers can word it. */
export type AccessDecision =
  /** Owners and admins: every lesson, without enrolling or paying. */
  | { readonly kind: 'manage'; readonly role: 'owner' | 'admin' }
  /**
   * Every lesson: the course is free, payments are not on yet (early access), or the viewer's own
   * membership or a seat on someone else's counts.
   */
  | { readonly kind: 'open'; readonly reason: 'free' | 'early_access' | 'membership' | 'seat' }
  /** Every lesson, for life: a grant from early access, a purchase, a gift or an admin. */
  | { readonly kind: 'open'; readonly reason: 'grant'; readonly source: AccessSource }
  /** Free previews only. */
  | { readonly kind: 'locked'; readonly reason: 'signed_out' | 'payment_required' | 'unpriced' };

/** The viewer as the rule sees them. */
export type AccessViewer = { readonly isOwner: boolean; readonly isAdmin: boolean };

/** The viewer's grant for the course. */
export type AccessGrant = { readonly source: AccessSource; readonly revoked: boolean };

/** What decides whether a membership counts. */
export type MembershipStanding = {
  readonly status: MembershipStatus;
  readonly currentPeriodEnd: Date;
  readonly trialEndsAt: Date | null;
};

/** What the viewer holds that can open a priced course. */
export type Entitlements = {
  readonly grant: AccessGrant | null;
  /** Memberships the viewer pays for. */
  readonly memberships: readonly MembershipStanding[];
  /** Memberships the viewer holds a seat on (Family and Community). */
  readonly seatMemberships: readonly MembershipStanding[];
};

/** Everything the rule decides from, for one published course and one viewer. */
export type AccessFacts = {
  readonly pricing: CoursePricing;
  readonly payments: PaymentsConfig;
  /** Null when signed out. */
  readonly viewer: AccessViewer | null;
  readonly entitlements: Entitlements;
  readonly now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The access rule. Pure: the loader below gathers the facts. */
export function decideCourseAccess(facts: AccessFacts): AccessDecision {
  return decisionBeforeEntitlements(facts) ?? decisionFromEntitlements(facts);
}

/**
 * Joining a course that is not free while payments are off earns an early-access grant, so the
 * course stays open to the learner once payments are on. Free courses stay free for everyone.
 */
export function earnsEarlyAccess(
  pricing: CoursePricing,
  payments: Pick<PaymentsConfig, 'enabled'>,
): boolean {
  return !payments.enabled && pricing.kind !== 'free';
}

/**
 * Whether a membership opens priced courses at `now`: while its trial or paid period runs, after
 * cancelling until the period ends, and for the grace days after a renewal failed. A trial ends
 * with its trial end date even if the period was set later.
 */
function membershipCounts(
  standing: MembershipStanding,
  now: Date,
  pastDueGraceDays: number,
): boolean {
  const { status, currentPeriodEnd, trialEndsAt } = standing;
  const after = (end: Date) => end.getTime() > now.getTime();
  switch (status) {
    case 'TRIALING':
      return after(currentPeriodEnd) && (trialEndsAt === null || after(trialEndsAt));
    case 'ACTIVE':
    case 'CANCELLED':
      return after(currentPeriodEnd);
    case 'PAST_DUE':
      return after(new Date(currentPeriodEnd.getTime() + pastDueGraceDays * DAY_MS));
    case 'EXPIRED':
      return false;
  }
}

/**
 * The decision when the viewer's grant and memberships cannot change it, else null: a priced
 * course, once payments are on, for someone who does not manage it. The loader reads entitlements
 * only in that case.
 */
function decisionBeforeEntitlements({
  pricing,
  payments,
  viewer,
}: Pick<AccessFacts, 'pricing' | 'payments' | 'viewer'>): AccessDecision | null {
  if (viewer?.isOwner) return { kind: 'manage', role: 'owner' };
  if (viewer?.isAdmin) return { kind: 'manage', role: 'admin' };
  if (!viewer) return { kind: 'locked', reason: 'signed_out' };
  if (pricing.kind === 'free') return { kind: 'open', reason: 'free' };
  if (earnsEarlyAccess(pricing, payments)) return { kind: 'open', reason: 'early_access' };
  if (pricing.kind === 'unpriced') return { kind: 'locked', reason: 'unpriced' };
  return null;
}

/** A priced course with payments on: a grant first (it lasts), then a membership, then a seat. */
function decisionFromEntitlements({ entitlements, payments, now }: AccessFacts): AccessDecision {
  const { grant, memberships, seatMemberships } = entitlements;
  if (grant && !grant.revoked) return { kind: 'open', reason: 'grant', source: grant.source };
  const counts = (standing: MembershipStanding) =>
    membershipCounts(standing, now, payments.pastDueGraceDays);
  if (memberships.some(counts)) return { kind: 'open', reason: 'membership' };
  if (seatMemberships.some(counts)) return { kind: 'open', reason: 'seat' };
  return { kind: 'locked', reason: 'payment_required' };
}

// ---- Loading the facts ----------------------------------------------------------------------

/** The course columns the rule reads; select them wherever a course's access is decided. */
export const courseAccessColumns = {
  id: true,
  instructorId: true,
  isFree: true,
  priceTier: true,
} satisfies Prisma.CourseSelect;

export type CourseForAccess = Prisma.CourseGetPayload<{ select: typeof courseAccessColumns }>;

const NO_ENTITLEMENTS: Entitlements = { grant: null, memberships: [], seatMemberships: [] };

const membershipStanding = {
  status: true,
  currentPeriodEnd: true,
  trialEndsAt: true,
} satisfies Prisma.MembershipSelect;

/**
 * The viewer's grants for these courses, and the memberships they pay for or hold an accepted
 * seat on, as each course's entitlements. Two queries, run together.
 */
async function readEntitlements(
  userId: string,
  courseIds: string[],
): Promise<(courseId: string) => Entitlements> {
  const db = getDb();
  const [grantRows, membershipRows] = await Promise.all([
    db.courseAccess.findMany({
      where: { userId, courseId: { in: courseIds } },
      select: { courseId: true, source: true, revokedAt: true },
    }),
    db.membership.findMany({
      where: {
        OR: [{ payerId: userId }, { seats: { some: { userId, acceptedAt: { not: null } } } }],
      },
      select: { payerId: true, ...membershipStanding },
    }),
  ]);
  const grants = new Map(
    grantRows.map((grant) => [
      grant.courseId,
      { source: grant.source, revoked: grant.revokedAt !== null },
    ]),
  );
  const memberships: MembershipStanding[] = [];
  const seatMemberships: MembershipStanding[] = [];
  for (const { payerId, ...standing } of membershipRows) {
    (payerId === userId ? memberships : seatMemberships).push(standing);
  }
  return (courseId) => ({ grant: grants.get(courseId) ?? null, memberships, seatMemberships });
}

function viewerOf(session: Session | null, course: CourseForAccess): AccessViewer | null {
  if (!session) return null;
  return { isOwner: course.instructorId === session.userId, isAdmin: hasRole(session, 'admin') };
}

/** Whether the viewer may open a published course, and why. */
export async function courseAccessFor(
  session: Session | null,
  course: CourseForAccess,
): Promise<AccessDecision> {
  const [access] = await courseAccessForMany(session, [course]);
  return access;
}

/**
 * courseAccessFor for several published courses, in their order. The viewer's grants and
 * memberships are read once, and only when some decision depends on them.
 */
export async function courseAccessForMany(
  session: Session | null,
  courses: readonly CourseForAccess[],
): Promise<AccessDecision[]> {
  const payments = paymentsConfig();
  const questions = courses.map((course) => ({
    courseId: course.id,
    known: { pricing: coursePricing(course), payments, viewer: viewerOf(session, course) },
  }));
  const undecided = questions.filter(({ known }) => decisionBeforeEntitlements(known) === null);
  const entitlementsFor =
    session && undecided.length > 0
      ? await readEntitlements(
          session.userId,
          undecided.map(({ courseId }) => courseId),
        )
      : () => NO_ENTITLEMENTS;
  const now = new Date();
  return questions.map(({ courseId, known }) =>
    decideCourseAccess({ ...known, entitlements: entitlementsFor(courseId), now }),
  );
}

/**
 * Records the early-access grant that joining the course earns (see earnsEarlyAccess), with the
 * caller's transaction. A grant that is already there is kept as it is.
 */
export async function recordEarlyAccess(
  db: Prisma.TransactionClient,
  userId: string,
  course: CourseForAccess,
): Promise<void> {
  if (!earnsEarlyAccess(coursePricing(course), paymentsConfig())) return;
  await db.courseAccess.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id, source: 'EARLY_ACCESS' },
    update: {},
  });
}

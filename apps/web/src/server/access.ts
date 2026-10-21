import 'server-only';
import type { AccessSource, Prisma } from '@/generated/prisma/client';
import { type CoursePricing, coursePricing } from '@/lib/pricing';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';
import { salesPhase } from '@/lib/early-access';
import { earlyAccessEndsAt } from './early-access';
import {
  type MembershipStanding,
  membershipOpensCourses,
  membershipStandingSelect,
} from './memberships';

// Who may open a course: the one rule behind the player, progress, enrolment, My Learning and the
// AI tools, and the only writer of course_access. A course's owner and admins manage it in any
// state; everyone else sees only published courses, and signed-out visitors only their free
// previews. During early access every course is open to everyone signed in. Once it has ended
// (src/server/early-access.ts), free courses stay open to everyone signed in, courses joined
// during early access stay open to those learners, priced courses open with a grant or a
// membership that counts, and courses without a price open to their owner and admins only.
//
// This module never imports from src/server/payments: checkout depends on access, not the other
// way round. Payments code may import this module and learning.ts.

/** Whether someone may open a course's lessons, and why, so callers can word it. */
export type AccessDecision =
  /** Owners and admins: every lesson, without enrolling or paying. */
  | { readonly kind: 'manage'; readonly role: 'owner' | 'admin' }
  /** Every lesson, once enrolled. */
  | {
      readonly kind: 'open';
      readonly reason: 'free' | 'early_access' | 'joined_in_early_access' | 'membership' | 'seat';
    }
  /** Every lesson, once enrolled, for life: bought, a gift or given by an admin. */
  | { readonly kind: 'open'; readonly reason: 'grant'; readonly source: AccessSource }
  /** Free previews only. */
  | { readonly kind: 'locked'; readonly reason: 'signed_out' | 'payment_required' | 'unpriced' }
  /** Not published: callers treat it as not found. */
  | { readonly kind: 'locked'; readonly reason: 'unpublished' };

export type OpenAccess = Extract<AccessDecision, { readonly kind: 'open' }>;

/** Why a course is open to someone, a grant included. */
export type OpenReason = OpenAccess['reason'];

/** A decision about a course the viewer may see: anything but unpublished. */
export type VisibleAccess = Exclude<AccessDecision, { readonly reason: 'unpublished' }>;

export function isVisible(access: AccessDecision): access is VisibleAccess {
  return !(access.kind === 'locked' && access.reason === 'unpublished');
}

/** The viewer as the rule sees them. */
export type AccessViewer = { readonly isOwner: boolean; readonly isAdmin: boolean };

/** One of the viewer's grants for the course: one per source. */
export type AccessGrant = { readonly source: AccessSource; readonly revoked: boolean };

/** What the viewer holds that can open a course once early access has ended. */
export type Entitlements = {
  /** When they enrolled in the course, if they have. */
  readonly enrolledAt: Date | null;
  /** Their grants for the course, earliest first; any unrevoked one opens it. */
  readonly grants: readonly AccessGrant[];
  /** Memberships the viewer pays for. */
  readonly memberships: readonly MembershipStanding[];
  /** Memberships the viewer holds a seat on (Family and Community). */
  readonly seatMemberships: readonly MembershipStanding[];
};

/** Everything the rule decides from, for one course and one viewer. */
export type AccessFacts = {
  readonly pricing: CoursePricing;
  readonly published: boolean;
  /** When early access ends; null while no end is set. */
  readonly earlyAccessEndsAt: Date | null;
  /** Null when signed out. */
  readonly viewer: AccessViewer | null;
  readonly entitlements: Entitlements;
  readonly now: Date;
};

/** The access rule. Pure: the loader below gathers the facts. */
export function decideCourseAccess(facts: AccessFacts): AccessDecision {
  return decisionBeforeEntitlements(facts) ?? decisionFromEntitlements(facts);
}

/**
 * The decision when the viewer's enrolment, grant and memberships cannot change it, else null: a
 * course that is not free, after early access, for a signed-in learner. The loader reads
 * entitlements only in that case.
 */
function decisionBeforeEntitlements({
  pricing,
  published,
  earlyAccessEndsAt,
  viewer,
  now,
}: Omit<AccessFacts, 'entitlements'>): AccessDecision | null {
  if (viewer?.isOwner) return { kind: 'manage', role: 'owner' };
  if (viewer?.isAdmin) return { kind: 'manage', role: 'admin' };
  if (!published) return { kind: 'locked', reason: 'unpublished' };
  if (!viewer) return { kind: 'locked', reason: 'signed_out' };
  if (pricing.kind === 'free') return { kind: 'open', reason: 'free' };
  if (salesPhase(earlyAccessEndsAt, now) === 'early_access') {
    return { kind: 'open', reason: 'early_access' };
  }
  return null;
}

/**
 * After early access: a course joined before the end stays open whatever its price; a course
 * without a price opens to no one else; a priced course opens with any unrevoked grant (it lasts),
 * then a membership, then a seat.
 */
function decisionFromEntitlements({
  pricing,
  earlyAccessEndsAt,
  entitlements,
  now,
}: AccessFacts): AccessDecision {
  const { enrolledAt, grants, memberships, seatMemberships } = entitlements;
  if (enrolledAt && earlyAccessEndsAt && enrolledAt.getTime() < earlyAccessEndsAt.getTime()) {
    return { kind: 'open', reason: 'joined_in_early_access' };
  }
  if (pricing.kind === 'unpriced') return { kind: 'locked', reason: 'unpriced' };
  const grant = grants.find((held) => !held.revoked);
  if (grant) return { kind: 'open', reason: 'grant', source: grant.source };
  const opens = (standing: MembershipStanding) => membershipOpensCourses(standing, now);
  if (memberships.some(opens)) return { kind: 'open', reason: 'membership' };
  if (seatMemberships.some(opens)) return { kind: 'open', reason: 'seat' };
  return { kind: 'locked', reason: 'payment_required' };
}

// ---- Loading the facts ----------------------------------------------------------------------

/** The course columns the rule reads; select them wherever a course's access is decided. */
export const courseAccessSelect = {
  id: true,
  instructorId: true,
  isFree: true,
  priceTier: true,
  status: true,
} satisfies Prisma.CourseSelect;

export type CourseForAccess = Prisma.CourseGetPayload<{ select: typeof courseAccessSelect }>;

const NO_ENTITLEMENTS: Entitlements = {
  enrolledAt: null,
  grants: [],
  memberships: [],
  seatMemberships: [],
};

/**
 * The viewer's enrolments and grants for these courses, and the memberships they pay for or hold
 * a seat on (a seat has a user once its invitation is accepted), as each course's entitlements.
 * Three queries, run together.
 */
async function readEntitlements(
  userId: string,
  courseIds: string[],
): Promise<(courseId: string) => Entitlements> {
  const db = getDb();
  const forCourses = { userId, courseId: { in: courseIds } };
  const [enrollmentRows, grantRows, membershipRows] = await Promise.all([
    db.enrollment.findMany({ where: forCourses, select: { courseId: true, enrolledAt: true } }),
    db.courseAccess.findMany({
      where: forCourses,
      orderBy: { grantedAt: 'asc' },
      select: { courseId: true, source: true, revokedAt: true },
    }),
    db.membership.findMany({
      where: { OR: [{ payerId: userId }, { seats: { some: { userId } } }] },
      select: { payerId: true, ...membershipStandingSelect },
    }),
  ]);
  const enrolledAt = new Map(enrollmentRows.map((row) => [row.courseId, row.enrolledAt]));
  const grants = new Map<string, AccessGrant[]>();
  for (const row of grantRows) {
    const forCourse = grants.get(row.courseId) ?? [];
    forCourse.push({ source: row.source, revoked: row.revokedAt !== null });
    grants.set(row.courseId, forCourse);
  }
  const memberships: MembershipStanding[] = [];
  const seatMemberships: MembershipStanding[] = [];
  for (const { payerId, ...standing } of membershipRows) {
    (payerId === userId ? memberships : seatMemberships).push(standing);
  }
  return (courseId) => ({
    enrolledAt: enrolledAt.get(courseId) ?? null,
    grants: grants.get(courseId) ?? [],
    memberships,
    seatMemberships,
  });
}

function viewerOf(session: Session | null, course: CourseForAccess): AccessViewer | null {
  if (!session) return null;
  return { isOwner: course.instructorId === session.userId, isAdmin: hasRole(session, 'admin') };
}

/** Whether the viewer may open a course, and why. */
export async function courseAccessFor(
  session: Session | null,
  course: CourseForAccess,
): Promise<AccessDecision> {
  const [access] = await courseAccessForMany(session, [course]);
  return access;
}

/**
 * courseAccessFor for several courses, in their order. The viewer's entitlements are read once,
 * and only when some decision depends on them.
 */
export async function courseAccessForMany(
  session: Session | null,
  courses: readonly CourseForAccess[],
): Promise<AccessDecision[]> {
  const endsAt = earlyAccessEndsAt();
  const now = new Date();
  const questions = courses.map((course) => ({
    courseId: course.id,
    known: {
      pricing: coursePricing(course),
      published: course.status === 'PUBLISHED',
      earlyAccessEndsAt: endsAt,
      viewer: viewerOf(session, course),
      now,
    },
  }));
  const undecided = questions.filter(({ known }) => decisionBeforeEntitlements(known) === null);
  const entitlementsFor =
    session && undecided.length > 0
      ? await readEntitlements(
          session.userId,
          undecided.map(({ courseId }) => courseId),
        )
      : () => NO_ENTITLEMENTS;
  return questions.map(({ courseId, known }) =>
    decideCourseAccess({ ...known, entitlements: entitlementsFor(courseId) }),
  );
}

// ---- Granting access ------------------------------------------------------------------------

/** Lifetime access to one course for one person, from one source. */
export type CourseGrant = {
  readonly userId: string;
  readonly courseId: string;
  readonly source: AccessSource;
};

/**
 * Gives the person lifetime access to the course from this source, inside the caller's
 * transaction, reviving that source's grant if it was revoked. Grants from other sources are
 * separate rows and stay as they are.
 */
export async function grantCourseAccess(
  db: Prisma.TransactionClient,
  { userId, courseId, source }: CourseGrant,
): Promise<void> {
  await db.courseAccess.upsert({
    where: { userId_courseId_source: { userId, courseId, source } },
    create: { userId, courseId, source },
    update: { revokedAt: null },
  });
}

/**
 * Revokes the person's grant for the course from this source (a refunded purchase, a withdrawn
 * gift), inside the caller's transaction; grants from other sources keep the course open. The row
 * is kept, revoked. Phase 14b also matches the refunded order.
 */
export async function revokeCourseAccess(
  db: Prisma.TransactionClient,
  { userId, courseId, source }: CourseGrant,
): Promise<void> {
  await db.courseAccess.updateMany({
    where: { userId, courseId, source, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

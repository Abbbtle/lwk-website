import Link from 'next/link';
import { type AccessLock, accessLockMessage } from '@/server/learning';

// Why a course is closed to the learner (a paid course they have no access to, no price yet, or
// access that has ended), with the way to open it where there is one. Checkout comes later, so
// the way is Plans & Pricing for now; a course without a price has no way yet.

export function AccessLockNote({
  lock,
  enrolled,
  variant,
}: {
  lock: AccessLock;
  /** Enrolled learners keep their place and progress. */
  enrolled: boolean;
  /** The course page's enroll box, or the panel in place of a locked lesson. */
  variant: 'course' | 'lesson';
}) {
  const lesson = variant === 'lesson';
  const kept = lock === 'access_ended' || (enrolled && lock === 'unpriced');
  return (
    <>
      <p className={lesson ? 'text-lg font-semibold' : 'font-semibold'}>
        {accessLockMessage(lock)}
      </p>
      {kept && (
        <p className={lesson ? 'text-gray-700' : 'text-sm text-gray-600'}>
          Your place and progress are kept.
        </p>
      )}
      {lock !== 'unpriced' && (
        <Link href="/plans-and-pricing" className={lesson ? 'btn-brand' : 'btn-brand w-full'}>
          See plans
        </Link>
      )}
    </>
  );
}

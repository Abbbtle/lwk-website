import Link from 'next/link';
import { formatEarlyAccessEnd } from '@/server/early-access';

/**
 * The early access offer, as a large saffron panel, with its end date once one is set. Shown only
 * during early access. Signed-in people are sent to the courses.
 */
export function EarlyAccess({ signedIn, endsAt }: { signedIn: boolean; endsAt: Date | null }) {
  return (
    <section aria-labelledby="early-access" className="page-width">
      <div className="rounded-3xl bg-brand px-6 py-14 text-center sm:px-12 lg:py-20">
        <h2
          id="early-access"
          className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-balance text-black md:text-5xl"
        >
          Every course is free during early access
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-black/80">
          Join any course today at no cost, and the courses you join stay yours when paid plans
          open. Courses marked Free stay free for everyone.
        </p>
        {endsAt && (
          <p className="mt-4 text-lg font-semibold text-black">
            Early access ends on {formatEarlyAccessEnd(endsAt)}.
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          {signedIn ? (
            <Link href="/courses" className="btn-solid">
              Browse courses
            </Link>
          ) : (
            <Link href="/sign-up" className="btn-solid">
              Create free account
            </Link>
          )}
          <Link href="/plans-and-pricing" className="btn-outline">
            See plans
          </Link>
        </div>
      </div>
    </section>
  );
}

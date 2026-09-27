'use client';

import Link from 'next/link';

// Shown when an instructor action fails, e.g. editing a course that was just submitted.
export default function InstructorError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">That change could not be saved</h1>
      <p className="mt-3 text-gray-700">
        The course may have been submitted for review or changed in another tab. Reload the page to
        see its current state.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-solid">
          Try again
        </button>
        <Link href="/instructor" className="btn-outline">
          Dashboard
        </Link>
      </div>
    </div>
  );
}

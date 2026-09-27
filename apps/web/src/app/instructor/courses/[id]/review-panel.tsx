'use client';

import { useActionState } from 'react';
import { type ReviewState, submitForReview, withdrawSubmission } from '../../actions';

export function ReviewPanel({
  courseId,
  status,
  missing,
  reviewNote,
}: {
  courseId: string;
  status: string;
  missing: string[];
  reviewNote: string | null;
}) {
  const [state, submit, pending] = useActionState<ReviewState>(
    submitForReview.bind(null, courseId),
    {},
  );

  return (
    <div className="space-y-4 border border-gray-300 p-6">
      <h2 className="text-xl font-bold">Review</h2>

      {reviewNote && status === 'DRAFT' && (
        <div className="border-l-4 border-brand bg-surface p-3 text-sm">
          <p className="font-semibold">Feedback from the last review</p>
          <p className="mt-1 whitespace-pre-line">{reviewNote}</p>
        </div>
      )}

      {status === 'DRAFT' && (
        <>
          {missing.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Before submitting:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              Everything is in place. An admin will review the course before it is published.
            </p>
          )}
          {state.error && (
            <p aria-live="polite" className="text-sm text-red-700">
              {state.error}
            </p>
          )}
          <form action={submit}>
            <button
              type="submit"
              className="btn-brand w-full"
              disabled={pending || missing.length > 0}
            >
              {pending ? 'Submitting...' : 'Submit for review'}
            </button>
          </form>
        </>
      )}

      {status === 'IN_REVIEW' && (
        <>
          <p className="text-sm text-gray-700">
            This course is waiting for review and cannot be edited. Withdraw it to make changes.
          </p>
          <form action={withdrawSubmission.bind(null, courseId)}>
            <button type="submit" className="btn-outline w-full">
              Withdraw from review
            </button>
          </form>
        </>
      )}

      {status === 'PUBLISHED' && (
        <p className="text-sm text-gray-700">
          This course is live. Contact an admin if it needs changes.
        </p>
      )}
    </div>
  );
}

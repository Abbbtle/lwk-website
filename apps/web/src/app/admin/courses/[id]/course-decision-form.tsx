'use client';

import { useActionState } from 'react';
import { type CourseDecisionState, decideCourse } from '../actions';

export function CourseDecisionForm({ id, status }: { id: string; status: string }) {
  const [state, formAction, pending] = useActionState<CourseDecisionState, FormData>(
    decideCourse,
    {},
  );
  if (status !== 'IN_REVIEW' && status !== 'PUBLISHED') return null;

  return (
    <form action={formAction} className="space-y-4 border border-gray-300 p-6">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-xl font-bold">Decision</h2>
      {state.error && (
        <p aria-live="polite" className="border-l-4 border-red-600 bg-red-50 p-3 text-red-900">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="note" className="block font-medium">
          Note to the instructor
          <span className="font-normal text-gray-500">
            {status === 'IN_REVIEW' ? ' (required when returning)' : ' (optional)'}
          </span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          maxLength={4000}
          className="w-full border border-gray-300 px-4 py-2.5 focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {status === 'IN_REVIEW' ? (
          <>
            <button
              type="submit"
              name="decision"
              value="publish"
              disabled={pending}
              className="btn-brand"
            >
              Publish
            </button>
            <button
              type="submit"
              name="decision"
              value="return"
              disabled={pending}
              className="btn-outline"
            >
              Return to instructor
            </button>
          </>
        ) : (
          <button
            type="submit"
            name="decision"
            value="unpublish"
            disabled={pending}
            className="btn-outline"
          >
            Unpublish for changes
          </button>
        )}
      </div>
    </form>
  );
}

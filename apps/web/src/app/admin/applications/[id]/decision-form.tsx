'use client';

import { useActionState } from 'react';
import { decideApplication, type DecisionState } from '../actions';

export function DecisionForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<DecisionState, FormData>(
    decideApplication,
    {},
  );

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
          Note to the applicant <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={2000}
          className="w-full border border-gray-300 px-4 py-2.5 focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="btn-brand"
        >
          Approve as instructor
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="btn-outline"
        >
          Do not approve
        </button>
      </div>
    </form>
  );
}

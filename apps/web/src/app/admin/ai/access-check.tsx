'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useActionState } from 'react';
import { type CheckState, runAccessCheck } from './actions';

export function AccessCheck() {
  const [state, action, pending] = useActionState<CheckState>(runAccessCheck, {});
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className="btn-outline disabled:opacity-60">
        {pending ? 'Checking...' : 'Check AI access'}
      </button>
      {state.results && (
        <ul aria-live="polite" className="space-y-2 text-sm">
          {state.results.map((r) => (
            <li key={r.role} className="flex items-start gap-2">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden />
              )}
              <span>
                <span className="font-semibold capitalize">{r.role}</span> ({r.model}):{' '}
                {r.ok ? `works (replied "${r.detail}")` : r.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

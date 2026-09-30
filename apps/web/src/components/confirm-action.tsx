'use client';

import { useState, useTransition } from 'react';

type Result = { error?: string; done?: string } | undefined;

/**
 * A button for a consequential admin action: the first click explains what will happen and asks
 * for confirmation; Cancel has focus, so Enter never confirms by accident.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  action,
  tone = 'default',
}: {
  label: string;
  /** What will happen, shown when asking for confirmation. */
  question: string;
  confirmLabel: string;
  action: () => Promise<Result>;
  tone?: 'default' | 'danger';
}) {
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<Result>();
  const [pending, startTransition] = useTransition();

  const danger = tone === 'danger';
  const confirmClass = danger
    ? 'btn border-red-700 bg-red-700 text-white hover:bg-red-800 disabled:opacity-60'
    : 'btn-solid disabled:opacity-60';

  return (
    <div className="space-y-3">
      {!asking ? (
        <button
          type="button"
          onClick={() => {
            setResult(undefined);
            setAsking(true);
          }}
          className={
            danger
              ? 'btn border-red-700 text-red-700 hover:bg-red-700 hover:text-white'
              : 'btn-outline'
          }
        >
          {label}
        </button>
      ) : (
        <div className="space-y-3 border border-gray-300 bg-surface p-4">
          <p className="text-sm">{question}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              onClick={() => setAsking(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              className={confirmClass}
              onClick={() =>
                startTransition(async () => {
                  const outcome = await action();
                  setResult(outcome);
                  if (!outcome?.error) setAsking(false);
                })
              }
            >
              {pending ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite">
        {result?.error && (
          <p className="border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900">
            {result.error}
          </p>
        )}
        {result?.done && (
          <p className="border-l-4 border-green-700 bg-green-50 p-3 text-sm text-green-900">
            {result.done}
          </p>
        )}
      </div>
    </div>
  );
}

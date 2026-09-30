'use client';

import { useState } from 'react';
import type { CognitoClientConfig } from '@/lib/auth-client';
import { deleteMyAccount } from '../actions';
import { ConfirmIdentity } from '../confirm-identity';

export function DeleteAccount({
  config,
  email,
  blocker,
}: {
  config: CognitoClientConfig;
  email: string;
  /** Why the account cannot be deleted yet, if anything. */
  blocker: string | null;
}) {
  const [step, setStep] = useState<'idle' | 'typing' | 'confirm'>('idle');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (blocker) {
    return <p className="border-l-4 border-brand bg-orange-50 p-4 text-sm">{blocker}</p>;
  }

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStep('typing')}
        className="btn border-red-700 text-red-700 hover:bg-red-700 hover:text-white"
      >
        Delete my account
      </button>
    );
  }

  if (step === 'typing') {
    return (
      <div className="space-y-4 border border-red-300 bg-red-50 p-5">
        <p className="font-semibold text-red-900">This cannot be undone.</p>
        <p className="text-sm text-red-900">
          Your account, enrollments, progress and applications will be deleted for good. Type DELETE
          to continue.
        </p>
        <label className="block text-sm font-medium" htmlFor="confirm-delete">
          Type DELETE
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="w-full border border-gray-300 bg-white px-3 py-2 focus:border-black focus:outline-none"
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" autoFocus onClick={() => setStep('idle')} className="btn-outline">
            Keep my account
          </button>
          <button
            type="button"
            disabled={typed.trim() !== 'DELETE'}
            onClick={() => setStep('confirm')}
            className="btn border-red-700 bg-red-700 text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      <ConfirmIdentity
        config={config}
        email={email}
        purpose="delete your account"
        onCancel={() => setStep('idle')}
        onConfirmed={async (auth) => {
          const result = await deleteMyAccount(auth.accessToken);
          // On success the action redirects away from this page.
          if (result?.error) {
            setError(result.error);
            setStep('typing');
          }
        }}
      />
    </div>
  );
}

'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { AuthError, AuthField } from '@/components/auth/auth-ui';
import {
  authErrorMessage,
  type CognitoClientConfig,
  type Reauthenticated,
  type ReauthResult,
  reauthenticate,
} from '@/lib/auth-client';

/**
 * "Confirm it's you": the password (and authenticator code, if two-step is on) again, checked by
 * Cognito in the browser. Sensitive changes only go ahead after this.
 */
export function ConfirmIdentity({
  config,
  email,
  purpose,
  onConfirmed,
  onCancel,
}: {
  config: CognitoClientConfig;
  email: string;
  /** What happens next, e.g. "change your password". */
  purpose: string;
  onConfirmed: (auth: Reauthenticated, password: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfa, setMfa] = useState<Extract<ReauthResult, { kind: 'mfa' }> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), [mfa]);

  async function handle(result: ReauthResult) {
    if (result.kind === 'mfa') {
      setMfa(result);
      setPending(false);
      return;
    }
    await onConfirmed(result.session, password);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!mfa && !password) return setError('Enter your password.');
    if (mfa && code.trim().length !== 6) return setError('Enter the 6-digit code.');
    setPending(true);
    try {
      await handle(
        mfa ? await mfa.submit(code.trim()) : await reauthenticate(config, email, password),
      );
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 border border-gray-300 bg-surface p-5">
      <h3 ref={heading} tabIndex={-1} className="font-bold focus:outline-none">
        {mfa ? 'Enter your authentication code' : "Confirm it's you"}
      </h3>
      <p className="text-sm text-gray-700">
        {mfa
          ? 'Open your authenticator app and enter the current code.'
          : `Enter your password to ${purpose}.`}
      </p>
      <AuthError message={error} />
      {mfa ? (
        <AuthField
          key="code"
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      ) : (
        <AuthField
          key="password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
          {pending ? 'Checking...' : 'Continue'}
        </button>
        <button type="button" onClick={onCancel} className="btn-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}

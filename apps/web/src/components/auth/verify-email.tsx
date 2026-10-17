'use client';

import { type FormEvent, useState } from 'react';
import {
  authErrorMessage,
  type CognitoClientConfig,
  confirmSignUp,
  resendCode,
} from '@/lib/auth-client';
import { AuthError, AuthField, AuthNotice, SubmitButton } from './auth-ui';

/** Enter the 6-digit code Cognito emailed after sign-up. */
export function VerifyEmail({
  config,
  email,
  onVerified,
}: {
  config: CognitoClientConfig;
  email: string;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await confirmSignUp(config, email, code);
      await onVerified();
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await resendCode(config, email);
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-center text-gray-700">
        We sent a 6-digit code to <span className="font-semibold">{email}</span>. It may take a
        minute; check your spam folder too.
      </p>
      <AuthError message={error} />
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <AuthField
        label="Verification code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      <SubmitButton pending={pending}>Verify email</SubmitButton>
      <p className="text-center text-sm">
        Didn&apos;t get it?{' '}
        <button type="button" onClick={resend} className="cursor-pointer font-semibold underline">
          Send a new code
        </button>
      </p>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import {
  authErrorMessage,
  type CognitoClientConfig,
  finishPasswordReset,
  goAfterSignIn,
  startPasswordReset,
} from '@/lib/auth-client';
import {
  AuthCard,
  AuthError,
  AuthField,
  PASSWORD_HINT,
  passwordProblem,
  SubmitButton,
} from './auth-ui';

export function ForgotPasswordForm({ config }: { config: CognitoClientConfig }) {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setPending(true);
    try {
      await startPasswordReset(config, email);
      setCodeSent(true);
    } catch (err) {
      // Same response whether or not the account exists, so emails cannot be probed.
      if ((err as { code?: string })?.code === 'UserNotFoundException') setCodeSent(true);
      else setError(authErrorMessage(err));
    }
    setPending(false);
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    setPending(true);
    try {
      await finishPasswordReset(config, email, code, password);
      goAfterSignIn('/login?reset=1');
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  const backToLogin = (
    <Link href="/login" className="font-semibold underline hover:text-brand">
      Back to log in
    </Link>
  );

  if (!codeSent) {
    return (
      <AuthCard
        title="Reset your password"
        subtitle="Enter your email and we'll send you a code."
        footer={backToLogin}
      >
        <form onSubmit={requestCode} noValidate className="space-y-5">
          <AuthError message={error} />
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SubmitButton pending={pending}>Send code</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={
        <>
          If an account exists for <span className="font-semibold">{email}</span>, we sent it a
          6-digit code.
        </>
      }
      footer={backToLogin}
    >
      <form onSubmit={reset} noValidate className="space-y-5">
        <AuthError message={error} />
        <AuthField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <AuthField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton pending={pending}>Save new password</SubmitButton>
      </form>
    </AuthCard>
  );
}

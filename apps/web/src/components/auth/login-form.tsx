'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import {
  authErrorMessage,
  type CognitoClientConfig,
  createSession,
  goAfterSignIn,
  type SignInResult,
  signIn,
} from '@/lib/auth-client';
import {
  AuthCard,
  AuthError,
  AuthField,
  PASSWORD_HINT,
  passwordProblem,
  SubmitButton,
} from './auth-ui';
import { VerifyEmail } from './verify-email';

type Step =
  | { name: 'credentials' }
  | { name: 'mfa'; submit: (code: string) => Promise<SignInResult> }
  | { name: 'new-password'; submit: (password: string) => Promise<SignInResult> }
  | { name: 'verify' };

export function LoginForm({
  config,
  returnTo,
  initialNotice,
}: {
  config: CognitoClientConfig;
  returnTo: string;
  initialNotice?: string;
}) {
  const [step, setStep] = useState<Step>({ name: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(result: SignInResult) {
    switch (result.kind) {
      case 'signed-in':
        // Full navigation so the header and pages render with the new session.
        goAfterSignIn(await createSession(result.tokens, returnTo));
        return;
      case 'mfa':
        setStep({ name: 'mfa', submit: result.submit });
        break;
      case 'new-password':
        setStep({ name: 'new-password', submit: result.submit });
        break;
      case 'unconfirmed':
        setStep({ name: 'verify' });
        break;
    }
    setPending(false);
  }

  async function run(action: () => Promise<SignInResult>) {
    setPending(true);
    setError(null);
    try {
      await handle(await action());
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email and password.');
    void run(() => signIn(config, email, password));
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (step.name === 'mfa') void run(() => step.submit(code.trim()));
  }

  function submitNewPassword(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(newPassword);
    if (problem) return setError(problem);
    if (step.name === 'new-password') void run(() => step.submit(newPassword));
  }

  if (step.name === 'verify') {
    return (
      <AuthCard title="Verify your email">
        <VerifyEmail
          config={config}
          email={email}
          onVerified={() => run(() => signIn(config, email, password))}
        />
      </AuthCard>
    );
  }

  if (step.name === 'mfa') {
    return (
      <AuthCard
        title="Two-step verification"
        subtitle="Enter the code from your authenticator app."
      >
        <form onSubmit={submitCode} noValidate className="space-y-5">
          <AuthError message={error} />
          <AuthField
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <SubmitButton pending={pending}>Continue</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  if (step.name === 'new-password') {
    return (
      <AuthCard title="Choose a new password" subtitle="Your account needs a new password.">
        <form onSubmit={submitNewPassword} noValidate className="space-y-5">
          <AuthError message={error} />
          <AuthField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={PASSWORD_HINT}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <SubmitButton pending={pending}>Save and log in</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  const signUpHref = `/sign-up${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to continue your learning."
      footer={
        <>
          New to Living With Krishna?{' '}
          <Link href={signUpHref} className="font-semibold underline hover:text-brand">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submitCredentials} noValidate className="space-y-5">
        {initialNotice && !error && (
          <p className="border-l-4 border-green-700 bg-green-50 p-3 text-sm text-green-900">
            {initialNotice}
          </p>
        )}
        <AuthError message={error} />
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="underline hover:text-brand">
            Forgot password?
          </Link>
        </div>
        <SubmitButton pending={pending}>Log In</SubmitButton>
      </form>
    </AuthCard>
  );
}

'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import {
  authErrorMessage,
  type CognitoClientConfig,
  createSession,
  goAfterSignIn,
  signIn,
  signUp,
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

export function SignUpForm({
  config,
  returnTo,
}: {
  config: CognitoClientConfig;
  returnTo: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The passwords do not match.');

    setPending(true);
    try {
      await signUp(config, name, email, password);
      setVerifying(true);
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setPending(false);
  }

  /** After the email is verified, sign straight in. */
  async function finish() {
    const result = await signIn(config, email, password);
    if (result.kind === 'signed-in') {
      goAfterSignIn(await createSession(result.tokens, returnTo));
    } else {
      goAfterSignIn(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }

  if (verifying) {
    return (
      <AuthCard title="Verify your email">
        <VerifyEmail config={config} email={email} onVerified={finish} />
      </AuthCard>
    );
  }

  const loginHref = `/login${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <AuthCard
      title="Join Living With Krishna"
      subtitle="Create a free account to start learning."
      footer={
        <>
          Already have an account?{' '}
          <Link href={loginHref} className="font-semibold underline hover:text-brand">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <AuthError message={error} />
        <AuthField
          label="Full name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <SubmitButton pending={pending}>Sign Up</SubmitButton>
      </form>
    </AuthCard>
  );
}

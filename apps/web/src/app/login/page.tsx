import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getCognitoClientConfig } from '@/server/auth/client-config';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Log In', robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === 'string' ? params.returnTo : null);
  if (await getSession()) redirect(returnTo);
  return (
    <LoginForm
      config={getCognitoClientConfig()}
      returnTo={returnTo}
      initialNotice={
        params.reset ? 'Your password was changed. Log in with the new one.' : undefined
      }
    />
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getCognitoClientConfig } from '@/server/auth/client-config';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Sign Up' };

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === 'string' ? params.returnTo : null);
  if (await getSession()) redirect(returnTo);
  return <SignUpForm config={getCognitoClientConfig()} returnTo={returnTo} />;
}

import type { Metadata } from 'next';
import { requireSession } from '@/server/auth/session';
import { AccountNav } from './account-nav';

export const metadata: Metadata = {
  title: { default: 'Your account', template: '%s | Your account' },
  robots: { index: false },
};

export default async function AccountLayout({ children }: LayoutProps<'/account'>) {
  const session = await requireSession('/account');
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-brand-ink uppercase">Hare Krishna, {session.name}</p>
      <h1 className="mt-1 mb-6 text-3xl font-extrabold md:text-4xl">Your account</h1>
      <AccountNav />
      {children}
    </div>
  );
}

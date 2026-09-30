import type { Metadata } from 'next';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getCognitoClientConfig } from '@/server/auth/client-config';
import { requireSession } from '@/server/auth/session';
import { SecuritySettings } from './security-settings';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage({ searchParams }: PageProps<'/account/security'>) {
  const session = await requireSession('/account/security');
  const { required, returnTo } = await searchParams;
  const isAdmin = session.roles.includes('admin') || session.adminNeedsMfa;

  return (
    <SecuritySettings
      config={getCognitoClientConfig()}
      email={session.email}
      mfaEnabled={session.mfaEnabled}
      isAdmin={isAdmin}
      adminRequired={required === 'admin' && isAdmin}
      returnTo={safeReturnTo(typeof returnTo === 'string' ? returnTo : undefined, '/admin')}
    />
  );
}

import type { Metadata } from 'next';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getCognitoClientConfig } from '@/server/auth/client-config';
import { requireSession, STAFF_ROLES } from '@/server/auth/session';
import { SecuritySettings } from './security-settings';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage({ searchParams }: PageProps<'/account/security'>) {
  const session = await requireSession('/account/security');
  const { required, returnTo } = await searchParams;
  const isStaff =
    session.lockedRoles.length > 0 || session.roles.some((role) => STAFF_ROLES.includes(role));

  return (
    <SecuritySettings
      config={getCognitoClientConfig()}
      email={session.email}
      mfaEnabled={session.mfaEnabled}
      isStaff={isStaff}
      staffRequired={required === 'staff' && isStaff}
      returnTo={safeReturnTo(typeof returnTo === 'string' ? returnTo : undefined, '/admin')}
    />
  );
}

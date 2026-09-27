import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';
import { requireRole } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminPage() {
  const session = await requireRole('admin', '/admin');
  return (
    <PagePlaceholder title="Administration" greeting={session.name}>
      <p>
        The course review queue, instructor applications and user roles arrive in the next phase.
      </p>
    </PagePlaceholder>
  );
}

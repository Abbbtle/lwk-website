import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';
import { requireRole } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Instructor', robots: { index: false } };

export default async function InstructorPage() {
  const session = await requireRole('instructor', '/instructor');
  return (
    <PagePlaceholder title="Instructor dashboard" greeting={session.name}>
      <p>Course creation, uploads and submissions for review arrive in the next phase.</p>
    </PagePlaceholder>
  );
}

import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';
import { requireSession } from '@/server/auth/session';

export const metadata: Metadata = { title: 'My Learning', robots: { index: false } };

export default async function MyLearningPage() {
  const session = await requireSession('/my-learning');
  return (
    <PagePlaceholder title="My Learning" greeting={`Hare Krishna, ${session.name}`}>
      <p>
        Courses you enroll in will appear here, with your progress. Enrollment opens soon; in the
        meantime, browse what is coming.
      </p>
    </PagePlaceholder>
  );
}

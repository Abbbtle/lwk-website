import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { getPlayer, LearningError } from '@/server/learning';

// /learn/<course> opens the lesson to resume: the first unfinished one the viewer may open.
export default async function ResumeCoursePage({ params }: PageProps<'/learn/[slug]'>) {
  const { slug } = await params;
  const player = await getPlayer(await getSession(), slug).catch((error) => {
    if (error instanceof LearningError) notFound();
    throw error;
  });
  redirect(`/learn/${slug}/${player.lesson.id}`);
}

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Lock,
  PlayCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { enrollInCourse } from '@/app/courses/[slug]/actions';
import { formatDuration, plural } from '@/lib/format';
import { getSession } from '@/server/auth/session';
import { getPlayer, LearningError, type PlayerLesson } from '@/server/learning';
import { CompleteButton } from './complete-button';
import { VideoPlayer } from './video-player';

const load = cache(async (slug: string, lessonId: string) => {
  if (!z.uuid().safeParse(lessonId).success) notFound();
  return getPlayer(await getSession(), slug, lessonId).catch((error) => {
    if (error instanceof LearningError) notFound();
    throw error;
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/learn/[slug]/[lessonId]'>): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const { lesson, course } = await load(slug, lessonId);
  return { title: `${lesson.title} - ${course.title}`, robots: { index: false } };
}

function LessonIcon({ lesson }: { lesson: PlayerLesson }) {
  if (!lesson.unlocked)
    return <Lock className="size-4 shrink-0 text-gray-400" aria-label="Locked" />;
  if (lesson.completed) {
    return <CheckCircle2 className="size-4 shrink-0 text-brand" aria-label="Completed" />;
  }
  return <Circle className="size-4 shrink-0 text-gray-400" aria-hidden />;
}

const typeIcon = { VIDEO: PlayCircle, PDF: FileText, TEXT: FileText };

export default async function LessonPage({ params }: PageProps<'/learn/[slug]/[lessonId]'>) {
  const { slug, lessonId } = await params;
  const session = await getSession();
  const player = await load(slug, lessonId);
  const { course, lesson } = player;
  const percent = player.totalLessons
    ? Math.round((player.completedCount / player.totalLessons) * 100)
    : 0;
  const lessonHref = (l: { id: string }) => `/learn/${course.slug}/${l.id}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/courses/${course.slug}`} className="text-sm font-semibold hover:text-brand">
          ← {course.title}
        </Link>
        {player.enrolled && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {player.completedCount} of {plural(player.totalLessons, 'lesson')} complete
            </span>
            <div
              className="h-2 w-32 bg-gray-200"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
            >
              <div className="h-2 bg-brand" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <article className="space-y-6 lg:col-span-2">
          <header>
            <p className="text-sm font-semibold text-brand uppercase">
              {lesson.isPreview && !player.enrolled ? 'Free preview' : course.category.name}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{lesson.title}</h1>
          </header>

          {!lesson.unlocked ? (
            <div className="space-y-4 bg-surface p-8 text-center">
              <Lock className="mx-auto size-8 text-gray-500" aria-hidden />
              <p className="text-lg font-semibold">Enroll to open this lesson.</p>
              <p className="text-gray-700">Free during early access.</p>
              {session ? (
                <form action={enrollInCourse.bind(null, course.slug)}>
                  <button type="submit" className="btn-brand">
                    Enroll now
                  </button>
                </form>
              ) : (
                <a
                  href={`/sign-up?returnTo=${encodeURIComponent(lessonHref(lesson))}`}
                  className="btn-brand"
                >
                  Sign up to enroll
                </a>
              )}
            </div>
          ) : lesson.type === 'VIDEO' ? (
            player.mediaUrl ? (
              <VideoPlayer
                key={lesson.id}
                src={player.mediaUrl}
                lessonId={lesson.id}
                courseSlug={course.slug}
                resumeAt={player.resumeAt}
                track={player.canTrackProgress}
                title={lesson.title}
              />
            ) : (
              <p className="bg-surface p-8 text-center text-gray-700">
                This video is not available yet.
              </p>
            )
          ) : lesson.type === 'PDF' ? (
            player.mediaUrl ? (
              <div className="space-y-3">
                <iframe
                  src={player.mediaUrl}
                  title={lesson.title}
                  className="h-[75vh] w-full border border-gray-300"
                />
                <a
                  href={player.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold underline"
                >
                  Open the PDF in a new tab
                </a>
              </div>
            ) : (
              <p className="bg-surface p-8 text-center text-gray-700">
                This document is not available yet.
              </p>
            )
          ) : (
            <div className="max-w-3xl text-lg leading-relaxed whitespace-pre-line text-gray-800">
              {lesson.body}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-300 pt-6">
            {player.canTrackProgress && lesson.unlocked ? (
              <CompleteButton
                lessonId={lesson.id}
                courseSlug={course.slug}
                completed={lesson.completed}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              {player.previous && (
                <Link href={lessonHref(player.previous)} className="btn-outline">
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </Link>
              )}
              {player.next && (
                <Link href={lessonHref(player.next)} className="btn-solid">
                  Next lesson
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </article>

        <aside aria-label="Course content" className="lg:sticky lg:top-6 lg:self-start">
          <div className="border border-gray-300">
            {player.sections.map((section, index) => (
              <section key={section.id}>
                <h2 className="border-b border-gray-300 bg-gray-100 px-4 py-3 text-sm font-bold">
                  {index + 1}. {section.title}
                </h2>
                <ol>
                  {section.lessons.map((l) => {
                    const Icon = typeIcon[l.type];
                    const current = l.id === lesson.id;
                    return (
                      <li key={l.id}>
                        <Link
                          href={lessonHref(l)}
                          aria-current={current ? 'page' : undefined}
                          className={`flex items-center gap-3 border-b border-gray-200 px-4 py-3 text-sm ${
                            current ? 'bg-brand/10 font-semibold' : 'hover:bg-gray-50'
                          }`}
                        >
                          <LessonIcon lesson={l} />
                          <span className="flex-1">{l.title}</span>
                          <Icon className="size-4 shrink-0 text-gray-400" aria-hidden />
                          {l.durationSeconds > 0 && (
                            <span className="shrink-0 text-xs text-gray-500">
                              {formatDuration(Math.max(1, Math.round(l.durationSeconds / 60)))}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

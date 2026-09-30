'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import {
  addOutline,
  applyCourseSuggestion,
  reviewCourseDraft,
  suggestCourseDetails,
  suggestOutline,
} from '@/app/ai-actions';
import { AiLabel } from '@/components/ai-label';
import { CourseReviewResult } from '@/components/course-review-result';
import { RichText } from '@/components/rich-text';
import type { CourseReview, DetailSuggestions, Outline } from '@/server/ai/tools';

const typeLabel = { VIDEO: 'Video', PDF: 'PDF', TEXT: 'Text' } as const;

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-gray-300 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4">
        <span className="font-semibold group-open:text-brand">{title}</span>
        <span className="block text-sm text-gray-600">{description}</span>
      </summary>
      <div className="space-y-4 border-t border-gray-200 px-5 py-4">{children}</div>
    </details>
  );
}

/** AI writing help in the course editor. Everything it suggests is applied only when chosen. */
export function AiCourseHelp({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ panel: string; message: string } | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [details, setDetails] = useState<DetailSuggestions | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [review, setReview] = useState<CourseReview | null>(null);
  const [added, setAdded] = useState(false);

  function run<T>(
    panel: string,
    work: () => Promise<{ data: T } | { error: string }>,
    done: (data: T) => void,
  ) {
    setError(null);
    start(async () => {
      const result = await work();
      if ('error' in result) setError({ panel, message: result.error });
      else done(result.data);
    });
  }
  const errorFor = (panel: string) =>
    error?.panel === panel && (
      <p role="alert" className="text-sm text-red-700">
        {error.message}
      </p>
    );

  function planOutline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(
      'outline',
      () =>
        suggestOutline(courseId, {
          about: String(form.get('about') ?? ''),
          audience: String(form.get('audience') ?? ''),
          size: String(form.get('size') ?? 'medium') as 'short' | 'medium' | 'long',
        }),
      (data) => {
        setOutline(data);
        setAdded(false);
      },
    );
  }

  const input =
    'w-full border border-gray-300 bg-surface px-3 py-2 text-sm focus:border-black focus:outline-none';

  return (
    <section aria-labelledby="ai-help-title" className="space-y-3">
      <h2 id="ai-help-title" className="flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="size-6 text-brand" aria-hidden /> AI writing help
      </h2>
      <p className="text-sm text-gray-700">
        Suggestions to get you started faster. Nothing changes until you choose to use it, and you
        stay the author: check facts, quotations and tone before publishing.
      </p>

      <Panel
        title="Plan the course"
        description="Describe what you want to teach and get a suggested outline."
      >
        <form onSubmit={planOutline} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="ai-about">
            What will learners learn?
          </label>
          <textarea
            id="ai-about"
            name="about"
            rows={3}
            required
            minLength={10}
            maxLength={1500}
            className={input}
            placeholder="For example: how to lead a simple kirtan, from choosing a melody to keeping the group together."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Who is it for? (optional)
              <input
                name="audience"
                maxLength={300}
                className={input}
                placeholder="Beginners who sing at home"
              />
            </label>
            <label className="block text-sm font-medium">
              Length
              <select name="size" defaultValue="medium" className={input}>
                <option value="short">Short (4 to 6 lessons)</option>
                <option value="medium">Medium (8 to 12 lessons)</option>
                <option value="long">Long (14 to 20 lessons)</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-solid px-4 py-2 text-sm disabled:opacity-60"
          >
            {pending ? 'Thinking...' : 'Suggest an outline'}
          </button>
        </form>
        {errorFor('outline')}
        {outline && (
          <div className="space-y-3">
            <ol className="space-y-3">
              {outline.sections.map((section, i) => (
                <li key={i}>
                  <p className="font-semibold">
                    {i + 1}. {section.title}
                  </p>
                  <ul className="mt-1 space-y-1 pl-5 text-sm">
                    {section.lessons.map((lesson, j) => (
                      <li key={j}>
                        <span className="font-medium">{lesson.title}</span>{' '}
                        <span className="text-gray-500">({typeLabel[lesson.type]})</span>
                        <span className="block text-gray-600">{lesson.summary}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {outline.advice && (
              <RichText text={outline.advice} size="sm" className="text-gray-700" />
            )}
            <AiLabel />
            {added ? (
              <p role="status" className="text-sm font-semibold text-green-800">
                Added to your curriculum. Fill in each lesson, and remove anything you do not need.
              </p>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    'outline',
                    () => addOutline(courseId, outline),
                    () => {
                      setAdded(true);
                      router.refresh();
                    },
                  )
                }
                className="btn-outline px-4 py-2 text-sm disabled:opacity-60"
              >
                Add these sections and lessons to my course
              </button>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Improve the course page"
        description="Suggestions for the subtitle, description and learning outcomes."
      >
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              'details',
              () => suggestCourseDetails(courseId),
              (data) => {
                setDetails(data);
                setUsed([]);
              },
            )
          }
          className="btn-solid px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? 'Thinking...' : 'Suggest improvements'}
        </button>
        {errorFor('details')}
        {details && (
          <div className="space-y-4">
            {(
              [
                ['subtitle', 'Subtitle', details.subtitle],
                ['description', 'Description', details.description],
                ['outcomes', 'What learners will learn', details.outcomes],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name} className="space-y-2 border-l-4 border-gray-300 pl-3">
                <p className="text-sm font-semibold">{label}</p>
                {Array.isArray(value) ? (
                  <ul className="list-disc pl-5 text-sm">
                    {value.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <RichText text={value} size="sm" />
                )}
                {used.includes(name) ? (
                  <p className="text-sm text-green-800">Used. You can still edit it above.</p>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        'details',
                        () =>
                          applyCourseSuggestion(
                            courseId,
                            name === 'outcomes'
                              ? { name, value: [...details.outcomes] }
                              : { name, value: value as string },
                          ),
                        () => {
                          setUsed([...used, name]);
                          router.refresh();
                        },
                      )
                    }
                    className="btn-outline px-3 py-1.5 text-sm disabled:opacity-60"
                  >
                    Use this
                  </button>
                )}
              </div>
            ))}
            {details.notes && <p className="text-sm text-gray-700">{details.notes}</p>}
            <AiLabel />
          </div>
        )}
      </Panel>

      <Panel
        title="Check before submitting"
        description="An AI read-through of the whole course, like an editor would do."
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => run('review', () => reviewCourseDraft(courseId), setReview)}
          className="btn-solid px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? 'Reading the course...' : 'Check my course'}
        </button>
        {errorFor('review')}
        {review && <CourseReviewResult review={review} />}
      </Panel>
    </section>
  );
}

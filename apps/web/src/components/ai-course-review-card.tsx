'use client';

import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { reviewCourseDraft } from '@/app/ai-actions';
import type { CourseReview } from '@/server/ai/tools';
import { CourseReviewResult } from './course-review-result';

/** "Review with AI" on the admin course review page. */
export function AiCourseReviewCard({ courseId }: { courseId: string }) {
  const [review, setReview] = useState<CourseReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 border border-gray-300 bg-white p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Sparkles className="size-4 text-brand" aria-hidden /> AI review
      </h2>
      <p className="text-sm text-gray-600">
        A read-through for clarity, structure, accuracy and accessibility. You decide.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await reviewCourseDraft(courseId);
            if ('error' in result) setError(result.error);
            else setReview(result.data);
          })
        }
        className="btn-outline w-full px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Reading the course...' : review ? 'Review again' : 'Review with AI'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {review && <CourseReviewResult review={review} />}
    </section>
  );
}

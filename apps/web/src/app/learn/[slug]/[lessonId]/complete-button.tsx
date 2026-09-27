'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setLessonComplete } from '../../actions';

export function CompleteButton({
  lessonId,
  courseSlug,
  completed,
}: {
  lessonId: string;
  courseSlug: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-pressed={completed}
        className={completed ? 'btn-outline' : 'btn-solid'}
        onClick={() =>
          startTransition(async () => {
            const result = await setLessonComplete(lessonId, courseSlug, !completed);
            setError(result.error ?? null);
            router.refresh();
          })
        }
      >
        <Check className="size-4" aria-hidden />
        {completed ? 'Completed (undo)' : 'Mark as complete'}
      </button>
      {error && (
        <p aria-live="polite" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

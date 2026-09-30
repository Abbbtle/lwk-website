import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { CourseReview } from '@/server/ai/tools';
import { AiLabel } from './ai-label';

const severityLabel = { must: 'Must fix', should: 'Should fix', could: 'Could improve' } as const;
const severityStyle = {
  must: 'border-red-700 text-red-700',
  should: 'border-brand text-brand-dark',
  could: 'border-gray-400 text-gray-600',
} as const;

/** The AI's review of a course, for the instructor before submitting and the admin reviewing. */
export function CourseReviewResult({ review }: { review: CourseReview }) {
  const order = { must: 0, should: 1, could: 2 };
  const suggestions = [...review.suggestions].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="space-y-3">
      <p
        className={`flex items-center gap-2 font-semibold ${review.ready ? 'text-green-800' : 'text-brand-dark'}`}
      >
        {review.ready ? (
          <CheckCircle2 className="size-5" aria-hidden />
        ) : (
          <CircleAlert className="size-5" aria-hidden />
        )}
        {review.ready ? 'Looks ready to publish' : 'Needs some work first'}
      </p>
      <p className="text-sm text-gray-800">{review.summary}</p>
      {suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span
                className={`h-fit shrink-0 border px-1.5 text-xs font-bold whitespace-nowrap uppercase ${severityStyle[s.severity]}`}
              >
                {severityLabel[s.severity]}
              </span>
              <span>
                <span className="font-semibold capitalize">{s.area}:</span> {s.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      <AiLabel>AI review: a second pair of eyes, not a decision.</AiLabel>
    </div>
  );
}

'use client';

import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { summariseApplicationWithAi } from '@/app/ai-actions';
import { AiLabel } from '@/components/ai-label';
import type { ApplicationSummary } from '@/server/ai/tools';

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** A neutral AI summary of an instructor application, to help (not replace) the decision. */
export function AiApplicationSummary({ applicationId }: { applicationId: string }) {
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 border border-gray-300 bg-white p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Sparkles className="size-4 text-brand-ink" aria-hidden /> AI summary
      </h2>
      {!summary && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await summariseApplicationWithAi(applicationId);
              if ('error' in result) setError(result.error);
              else setSummary(result.data);
            })
          }
          className="btn-outline w-full px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? 'Reading the application...' : 'Summarise with AI'}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {summary && (
        <div className="space-y-3">
          <p className="text-sm">{summary.summary}</p>
          <List title="Strengths" items={summary.strengths} />
          <List title="Open questions or concerns" items={summary.concerns} />
          <List title="You could ask" items={summary.questions} />
          <AiLabel>AI summary of what the applicant wrote. The decision is yours.</AiLabel>
        </div>
      )}
    </section>
  );
}

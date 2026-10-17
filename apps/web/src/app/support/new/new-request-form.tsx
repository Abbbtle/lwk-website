'use client';

import { ChevronRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { FormStatus, TextAreaField, TextField } from '@/components/form-fields';
import type { FormState } from '@/lib/forms/form-state';
import { createSupportRequest } from '../actions';

type Category = { value: string; label: string; hint: string };
type Suggestion = { slug: string; title: string; summary: string };

export function NewRequestForm({
  categories,
  initialCategory,
  pageUrl,
}: {
  categories: Category[];
  initialCategory?: string;
  pageUrl?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSupportRequest, {
    status: 'idle',
    values: { category: initialCategory ?? '', pageUrl: pageUrl ?? '', includeBrowser: 'on' },
  });
  const [subject, setSubject] = useState(state.values?.subject ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const error = state.errors?.category?.[0];

  // Articles that might answer the question before it is sent.
  useEffect(() => {
    const q = subject.trim();
    if (q.length < 4) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/help?${new URLSearchParams({ q })}`);
        const { data } = (await response.json()) as { data: { results: Suggestion[] } };
        if (current) setSuggestions(data.results.slice(0, 3));
      } catch {
        // Suggestions are optional.
      }
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [subject]);

  return (
    <form action={action} noValidate className="space-y-6">
      <FormStatus state={state} />

      <fieldset aria-describedby={error ? 'category-error' : undefined}>
        <legend className="text-sm font-medium">What is your request about?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <label
              key={category.value}
              className="flex cursor-pointer items-start gap-3 border border-gray-300 bg-white p-3 has-checked:border-black has-checked:shadow-[0_3px_0_0_black]"
            >
              <input
                type="radio"
                name="category"
                value={category.value}
                defaultChecked={state.values?.category === category.value}
                className="mt-1 accent-black"
              />
              <span>
                <span className="block font-semibold">{category.label}</span>
                {category.hint && (
                  <span className="block text-sm text-gray-600">{category.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>
        {error && (
          <p id="category-error" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="subject" className="block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          aria-invalid={state.errors?.subject ? true : undefined}
          aria-describedby={state.errors?.subject ? 'subject-error' : undefined}
          className="w-full border border-gray-300 bg-surface px-3 py-2 focus:border-black focus:outline-none aria-invalid:border-red-600"
        />
        {state.errors?.subject && (
          <p id="subject-error" className="text-sm text-red-600">
            {state.errors.subject[0]}
          </p>
        )}
      </div>

      {suggestions.length > 0 && subject.trim().length >= 4 && (
        <aside aria-live="polite" className="border-l-4 border-brand bg-orange-50 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4" aria-hidden /> These articles might answer your question
          </p>
          <ul className="mt-2 space-y-1">
            {suggestions.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/help/${s.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-sm font-semibold underline hover:text-brand-ink"
                >
                  {s.title} <ChevronRight className="size-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <TextAreaField
        name="body"
        label="Message"
        hint="What were you trying to do, and what happened? For problems, include any message you saw."
        rows={7}
        required
        state={state}
      />
      <TextField
        name="pageUrl"
        label="Page this is about"
        hint="Filled in with the page you came from. Clear it if it is not relevant."
        state={state}
      />
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="includeBrowser"
          defaultChecked={state.values?.includeBrowser === 'on'}
          className="mt-0.5 size-4 accent-black"
        />
        <span>
          Include my browser and device details
          <span className="block text-gray-500">Helps us fix technical problems faster.</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Sending...' : 'Send request'}
      </button>
    </form>
  );
}

'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

async function send(slug: string, helpful: boolean, comment?: string) {
  await fetch('/api/v1/help/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, helpful, comment }),
  }).catch(() => {});
}

/** "Was this helpful?" at the end of a help article. */
export function HelpFeedback({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [state, setState] = useState<'ask' | 'why' | 'thanks'>('ask');
  const [comment, setComment] = useState('');

  async function explain(event: FormEvent) {
    event.preventDefault();
    await send(slug, false, comment);
    setState('thanks');
  }

  return (
    <section aria-live="polite" className="border-t border-gray-300 pt-6">
      {state === 'ask' && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="font-semibold">Was this article helpful?</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              onClick={() => {
                void send(slug, true);
                setState('thanks');
              }}
            >
              <ThumbsUp className="size-4" aria-hidden /> Yes
            </button>
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              onClick={() => setState('why')}
            >
              <ThumbsDown className="size-4" aria-hidden /> No
            </button>
          </div>
        </div>
      )}
      {state === 'why' && (
        <form onSubmit={explain} className="space-y-3">
          <label htmlFor="help-comment" className="block font-semibold">
            Sorry about that. What were you looking for?
          </label>
          <textarea
            id="help-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-gray-300 bg-white px-3 py-2 focus:border-black focus:outline-none"
          />
          <p className="text-sm text-gray-600">
            This goes to the team that writes these articles. It is not a support request.
          </p>
          <button type="submit" className="btn-solid px-4 py-2 text-sm">
            Send
          </button>
        </form>
      )}
      {state === 'thanks' && (
        <p className="text-gray-700">
          Thank you for your feedback.{' '}
          {signedIn ? (
            <>
              Still need help?{' '}
              <Link href="/support/new" className="font-semibold underline hover:text-brand">
                Send a support request
              </Link>
              .
            </>
          ) : (
            <>
              Still need help?{' '}
              <Link href="/contact" className="font-semibold underline hover:text-brand">
                Contact us
              </Link>
              .
            </>
          )}
        </p>
      )}
    </section>
  );
}

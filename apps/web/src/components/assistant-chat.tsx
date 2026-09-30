'use client';

import { ArrowUp, LifeBuoy, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { RichText } from '@/components/rich-text';

type Article = { slug: string; title: string; summary: string };
type ServerEvent =
  | { type: 'text'; text: string }
  | { type: 'sources'; items: { title: string; href: string }[] }
  | { type: 'handoff'; subject: string; reason: string }
  | { type: 'fallback'; reason: 'unavailable' | 'budget'; articles: Article[] }
  | { type: 'done' };
type Entry =
  | { id: number; role: 'user'; content: string }
  | {
      id: number;
      role: 'assistant';
      content: string;
      pending?: boolean;
      sources?: { title: string; href: string }[];
      handoff?: { subject: string; reason: string };
      fallback?: { reason: 'unavailable' | 'budget'; articles: Article[] };
      error?: string;
      rated?: boolean;
    };

const STORAGE_KEY = 'lwk-assistant';

/** Starting questions that fit the page. */
function suggestionsFor(path: string, signedIn: boolean): string[] {
  if (path.startsWith('/learn/')) {
    return [
      'Summarise this lesson for me',
      'Explain the main idea simply',
      'What should I do next?',
    ];
  }
  if (path.startsWith('/instructor')) {
    return [
      'What is missing before I can submit my course?',
      'How do I upload a video?',
      'Tips for a great course',
    ];
  }
  if (path.startsWith('/admin'))
    return ['What needs my attention?', 'How do I give someone a role?'];
  if (path.startsWith('/support'))
    return ['What is the status of my requests?', 'How long do replies take?'];
  if (path.startsWith('/explore'))
    return ['Find free kirtan recordings', 'What free courses are there?'];
  if (path.startsWith('/account'))
    return ['How do I turn on two-step verification?', 'How do I download my data?'];
  return signedIn
    ? ['Where are my courses?', 'What can I learn for free?', 'How do I reset my password?']
    : ['What is Living With Krishna?', 'What can I learn for free?', 'How do I create an account?'];
}

function loadSaved(): Entry[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved
      ? (JSON.parse(saved) as Entry[]).filter((e) => !(e.role === 'assistant' && e.pending))
      : [];
  } catch {
    return [];
  }
}

/** The assistant in the help panel. The conversation stays in this browser tab only. */
export function AssistantChat({ signedIn, name }: { signedIn: boolean; name?: string }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>(loadSaved);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLOListElement>(null);
  const nextId = useRef(Date.now());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-20)));
    } catch {
      // Private browsing: the conversation just is not kept across reloads.
    }
    log.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [entries]);

  function update(
    id: number,
    change: (entry: Extract<Entry, { role: 'assistant' }>) => Partial<Entry>,
  ) {
    setEntries((current) =>
      current.map((e) =>
        e.id === id && e.role === 'assistant' ? ({ ...e, ...change(e) } as Entry) : e,
      ),
    );
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...entries, { id: nextId.current++, role: 'user' as const, content: text }];
    const answerId = nextId.current++;
    setEntries([...history, { id: answerId, role: 'assistant', content: '', pending: true }]);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/v1/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          messages: history
            .filter((e) => e.content)
            .slice(-10)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        update(answerId, () => ({
          pending: false,
          error: body?.error?.message ?? 'Something went wrong. Please try again.',
        }));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as ServerEvent;
          if (event.type === 'text') update(answerId, (e) => ({ content: e.content + event.text }));
          else if (event.type === 'sources') update(answerId, () => ({ sources: event.items }));
          else if (event.type === 'handoff') {
            update(answerId, () => ({ handoff: { subject: event.subject, reason: event.reason } }));
          } else if (event.type === 'fallback') {
            update(answerId, () => ({
              fallback: { reason: event.reason, articles: event.articles },
            }));
          }
        }
      }
      update(answerId, () => ({ pending: false }));
    } catch {
      update(answerId, () => ({
        pending: false,
        error: 'The connection dropped. Please try again.',
      }));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void ask(input);
    }
  }

  async function rate(entry: Extract<Entry, { role: 'assistant' }>, helpful: boolean) {
    const index = entries.findIndex((e) => e.id === entry.id);
    const question =
      [...entries.slice(0, index)].reverse().find((e) => e.role === 'user')?.content ?? '';
    update(entry.id, () => ({ rated: true }));
    await fetch('/api/v1/assistant/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful, question, answer: entry.content, path: pathname }),
    }).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col">
      <ol
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the assistant"
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {entries.length === 0 && (
          <li className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-brand">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-gray-800">
                {name ? `Hare Krishna, ${name}! ` : 'Hare Krishna! '}I can answer questions about
                using Living With Krishna, find courses and free content, and pass things to our
                team when you need a person.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestionsFor(pathname, signedIn).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="cursor-pointer rounded-full border border-gray-300 px-3 py-1.5 text-left text-sm hover:border-black"
                >
                  {s}
                </button>
              ))}
            </div>
          </li>
        )}
        {entries.map((entry) =>
          entry.role === 'user' ? (
            <li
              key={entry.id}
              className="ml-8 bg-black px-4 py-3 text-sm whitespace-pre-line text-white"
            >
              <span className="sr-only">You: </span>
              {entry.content}
            </li>
          ) : (
            <li key={entry.id} className="mr-4 space-y-3 border border-gray-200 bg-white px-4 py-3">
              <span className="sr-only">Assistant: </span>
              {entry.content && <RichText text={entry.content} size="sm" />}
              {entry.pending && !entry.content && (
                <p className="flex items-center gap-1 text-sm text-gray-500" aria-label="Thinking">
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400" />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </p>
              )}
              {entry.error && <p className="text-sm text-red-700">{entry.error}</p>}
              {entry.fallback && (
                <div className="space-y-2 text-sm">
                  <p>
                    {entry.fallback.reason === 'budget'
                      ? 'The assistant is resting until next month.'
                      : 'The assistant is not available right now.'}{' '}
                    {entry.fallback.articles.length > 0
                      ? 'These articles may help:'
                      : 'The help centre and our team can help:'}
                  </p>
                  {entry.fallback.articles.length > 0 && (
                    <ul className="space-y-1">
                      {entry.fallback.articles.map((a) => (
                        <li key={a.slug}>
                          <Link
                            href={`/help/${a.slug}`}
                            className="font-semibold underline hover:text-brand"
                          >
                            {a.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={signedIn ? '/support/new' : '/contact'}
                    className="inline-block font-semibold underline"
                  >
                    Contact support
                  </Link>
                </div>
              )}
              {entry.sources && entry.sources.length > 0 && (
                <p className="flex flex-wrap gap-2 text-xs">
                  {entry.sources.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="rounded-full bg-gray-100 px-2 py-1 hover:bg-gray-200"
                    >
                      {s.title}
                    </Link>
                  ))}
                </p>
              )}
              {entry.handoff && (
                <Handoff
                  signedIn={signedIn}
                  suggestion={entry.handoff.subject}
                  transcript={entries
                    .slice(0, entries.findIndex((e) => e.id === entry.id) + 1)
                    .filter((e) => e.content)
                    .map(({ role, content }) => ({ role, content }))}
                  path={pathname}
                />
              )}
              {!entry.pending && entry.content && !entry.fallback && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {entry.rated ? (
                    <span>Thanks for the feedback.</span>
                  ) : (
                    <>
                      <span>Helpful?</span>
                      <button
                        type="button"
                        aria-label="Helpful"
                        onClick={() => void rate(entry, true)}
                        className="cursor-pointer p-1 hover:text-black"
                      >
                        <ThumbsUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Not helpful"
                        onClick={() => void rate(entry, false)}
                        className="cursor-pointer p-1 hover:text-black"
                      >
                        <ThumbsDown className="size-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ),
        )}
      </ol>

      <form onSubmit={submit} className="border-t border-gray-200 px-5 py-3">
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="assistant-input"
            rows={2}
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question..."
            className="max-h-32 min-h-11 flex-1 resize-none border border-gray-300 bg-surface px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center bg-black text-white disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-xs text-gray-500">
          <p>AI answers can be wrong. Never share passwords or codes.</p>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setEntries([])}
              disabled={busy}
              className="flex shrink-0 cursor-pointer items-center gap-1 hover:text-black"
            >
              <RotateCcw className="size-3" aria-hidden /> New chat
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** "Want a person to look at this?" under an answer, when the assistant suggests it. */
function Handoff({
  signedIn,
  suggestion,
  transcript,
  path,
}: {
  signedIn: boolean;
  suggestion: string;
  transcript: { role: 'user' | 'assistant'; content: string }[];
  path: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(suggestion);
  const [note, setNote] = useState('');
  const [state, setState] = useState<{ number?: number; error?: string; sending?: boolean }>({});

  if (!signedIn) {
    return (
      <p className="border-l-4 border-brand bg-orange-50 p-3 text-sm">
        Our team can help with this.{' '}
        <Link href="/contact" className="font-semibold underline">
          Contact us
        </Link>{' '}
        or{' '}
        <Link
          href={`/login?returnTo=${encodeURIComponent(path)}`}
          className="font-semibold underline"
        >
          log in
        </Link>{' '}
        to send a support request.
      </p>
    );
  }
  if (state.number) {
    return (
      <p className="border-l-4 border-green-700 bg-green-50 p-3 text-sm text-green-900">
        Sent as request{' '}
        <Link href={`/support/${state.number}`} className="font-semibold underline">
          #{state.number}
        </Link>
        . We reply in your account, usually within one working day.
      </p>
    );
  }

  async function send() {
    setState({ sending: true });
    const response = await fetch('/api/v1/assistant/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, note: note || undefined, transcript, path }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
      data?: { number: number };
      error?: { message: string };
    } | null;
    setState(
      body?.data
        ? { number: body.data.number }
        : { error: body?.error?.message ?? 'That did not work. Please try again.' },
    );
  }

  return (
    <div className="space-y-2 border-l-4 border-brand bg-orange-50 p-3 text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-2 font-semibold underline"
        >
          <LifeBuoy className="size-4" aria-hidden /> Send this conversation to support
        </button>
      ) : (
        <>
          <label htmlFor="handoff-subject" className="block font-semibold">
            Subject
          </label>
          <input
            id="handoff-subject"
            value={subject}
            maxLength={150}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-gray-300 bg-white px-2 py-1.5"
          />
          <label htmlFor="handoff-note" className="block font-semibold">
            Anything to add? (optional)
          </label>
          <textarea
            id="handoff-note"
            rows={2}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 bg-white px-2 py-1.5"
          />
          <p className="text-xs text-gray-600">
            This conversation is included, so you do not need to repeat it.
          </p>
          {state.error && <p className="text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state.sending || subject.trim().length < 4}
              onClick={() => void send()}
              className="btn-solid px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {state.sending ? 'Sending...' : 'Send to support'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-outline px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

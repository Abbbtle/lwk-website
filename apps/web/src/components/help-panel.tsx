'use client';

import { BookOpen, ChevronRight, CircleHelp, Flag, LifeBuoy, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

type ArticleSummary = { slug: string; title: string; summary: string };
type HelpData = { forPage: ArticleSummary[]; results: ArticleSummary[]; popular: ArticleSummary[] };

async function loadHelp(params: Record<string, string>): Promise<HelpData | null> {
  try {
    const response = await fetch(`/api/v1/help?${new URLSearchParams(params)}`);
    if (!response.ok) return null;
    return ((await response.json()) as { data: HelpData }).data;
  } catch {
    return null;
  }
}

function ArticleList({ articles }: { articles: ArticleSummary[] }) {
  return (
    <ul className="divide-y divide-gray-200 border border-gray-200">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            href={`/help/${article.slug}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <span>
              <span className="block text-sm font-semibold">{article.title}</span>
              <span className="block text-xs text-gray-600">{article.summary}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The Help button on every page. Opens a panel with help for the current page, search across
 * the help centre, and routes to a person when articles are not enough.
 */
export function HelpPanel({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<HelpData | null>(null);
  const [query, setQuery] = useState('');
  // Search results, kept with the question they answer so stale ones are never shown.
  const [search, setSearch] = useState<{ q: string; results: ArticleSummary[] } | null>(null);
  const q = query.trim();
  const results = q.length >= 2 && search?.q === q ? search.results : null;

  // Following a link inside the panel closes it.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void loadHelp({ path: pathname }).then((data) => current && setPage(data));
    return () => {
      current = false;
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!open || q.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      void loadHelp({ q }).then(
        (data) => current && setSearch({ q, results: data?.results ?? [] }),
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  const from = encodeURIComponent(pathname);
  const reportHref = signedIn
    ? `/support/new?category=TECHNICAL&from=${from}`
    : '/contact?type=feedback';
  const contactHref = signedIn ? `/support/new?from=${from}` : '/contact';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="fixed right-4 bottom-4 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-black px-4 py-3 font-bold text-white shadow-lg hover:bg-[#282828] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none print:hidden"
      >
        <CircleHelp className="size-5" aria-hidden />
        <span className="sr-only sm:not-sr-only">Help</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-transparent p-0 backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 id={titleId} className="text-xl font-extrabold">
              How can we help?
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close help"
              className="cursor-pointer p-1 text-gray-600 hover:text-black"
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div className="relative">
              <label htmlFor={`${titleId}-search`} className="sr-only">
                Search help
              </label>
              <input
                id={`${titleId}-search`}
                type="search"
                autoComplete="off"
                placeholder="Search help, e.g. 'reset password'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border border-gray-300 bg-surface py-2.5 pr-10 pl-3 focus:border-black focus:outline-none"
              />
              <Search
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500"
                aria-hidden
              />
            </div>

            <div aria-live="polite" className="space-y-6">
              {results !== null ? (
                results.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-600 uppercase">Articles</h3>
                    <ArticleList articles={results} />
                  </section>
                ) : (
                  <p className="text-sm text-gray-700">
                    No articles match. Try other words, or{' '}
                    <Link href={contactHref} className="font-semibold underline">
                      ask us
                    </Link>
                    .
                  </p>
                )
              ) : (
                <>
                  {page && page.forPage.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-gray-600 uppercase">About this page</h3>
                      <ArticleList articles={page.forPage} />
                    </section>
                  )}
                  {page && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-gray-600 uppercase">Popular</h3>
                      <ArticleList
                        articles={page.popular.filter(
                          (a) => !page.forPage.some((p) => p.slug === a.slug),
                        )}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-gray-200 text-center text-xs font-semibold">
            <Link
              href="/help"
              className="flex flex-col items-center gap-1 px-2 py-3 hover:bg-gray-50"
            >
              <BookOpen className="size-5" aria-hidden />
              Help centre
            </Link>
            <Link
              href={reportHref}
              className="flex flex-col items-center gap-1 border-x border-gray-200 px-2 py-3 hover:bg-gray-50"
            >
              <Flag className="size-5" aria-hidden />
              Report a problem
            </Link>
            <Link
              href={contactHref}
              className="flex flex-col items-center gap-1 px-2 py-3 hover:bg-gray-50"
            >
              <LifeBuoy className="size-5" aria-hidden />
              Contact support
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}

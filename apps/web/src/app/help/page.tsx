import { ChevronRight, LifeBuoy, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { popularArticles, searchHelp, topicsFor } from '@/lib/help';
import { getSession, hasRole } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Help centre',
  description: 'Answers about accounts, courses, free content, teaching and support.',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function HelpPage({ searchParams }: PageProps<'/help'>) {
  const query =
    single((await searchParams).q)
      ?.trim()
      .slice(0, 200) || undefined;
  const session = await getSession();
  const viewer = { staff: Boolean(session && hasRole(session, 'support')) };
  const results = query ? searchHelp(query, viewer, 12) : [];
  const topics = topicsFor(viewer);
  const popular = popularArticles(viewer);

  return (
    <>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="font-semibold text-brand uppercase">Help centre</p>
          <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">How can we help?</h1>
          <form action="/help" role="search" className="relative mt-8 max-w-2xl">
            <label htmlFor="help-search" className="sr-only">
              Search the help centre
            </label>
            <input
              id="help-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Describe your question, e.g. 'forgot my password'"
              className="w-full rounded-full border border-white bg-white py-3 pr-12 pl-5 text-black focus:ring-2 focus:ring-brand focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-black"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        {query && (
          <section aria-live="polite" className="space-y-4">
            <h2 className="text-2xl font-extrabold">
              {results.length > 0
                ? `Articles about “${query}”`
                : `We could not find an article about “${query}”`}
            </h2>
            {results.length > 0 ? (
              <ul className="divide-y divide-gray-200 bg-white shadow-md">
                {results.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/help/${article.slug}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                    >
                      <span>
                        <span className="font-semibold">{article.title}</span>
                        <span className="block text-sm text-gray-600">{article.summary}</span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-700">Try other words, browse the topics below, or ask us.</p>
            )}
          </section>
        )}

        {!query && (
          <section className="space-y-4">
            <h2 className="text-2xl font-extrabold">Popular questions</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {popular.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/help/${article.slug}`}
                    className="flex h-full items-center justify-between gap-3 bg-white px-5 py-4 shadow-md hover:shadow-lg"
                  >
                    <span className="font-semibold">{article.title}</span>
                    <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold">Browse by topic</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {topics.map((topic) => (
              <section key={topic.slug} id={topic.slug} className="bg-white p-6 shadow-md">
                <h3 className="text-lg font-bold">{topic.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{topic.description}</p>
                <ul className="mt-4 space-y-2">
                  {topic.articles.map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={`/help/${article.slug}`}
                        className="hover:text-brand hover:underline"
                      >
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 bg-black p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <LifeBuoy className="mt-1 size-8 shrink-0 text-brand" aria-hidden />
            <div>
              <h2 className="text-xl font-bold">Still need help?</h2>
              <p className="text-gray-300">
                {session
                  ? 'Send us a support request and follow the reply in your account.'
                  : 'Send us a message and we reply by email.'}{' '}
                We answer on working days, usually within one day.
              </p>
            </div>
          </div>
          <Link href={session ? '/support/new' : '/contact'} className="btn-brand shrink-0">
            {session ? 'Send a support request' : 'Contact us'}
          </Link>
        </section>
      </div>
    </>
  );
}

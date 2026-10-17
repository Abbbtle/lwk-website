import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/rich-text';
import { helpTopics } from '@/content/help';
import { getArticle, relatedArticles } from '@/lib/help';
import { getSession, hasRole } from '@/server/auth/session';
import { HelpFeedback } from '../help-feedback';

async function viewer() {
  const session = await getSession();
  return { session, viewer: { staff: Boolean(session && hasRole(session, 'support')) } };
}

export async function generateMetadata({ params }: PageProps<'/help/[slug]'>): Promise<Metadata> {
  const article = getArticle((await params).slug, (await viewer()).viewer);
  return article ? { title: `${article.title} | Help`, description: article.summary } : {};
}

export default async function HelpArticlePage({ params }: PageProps<'/help/[slug]'>) {
  const { slug } = await params;
  const { session, viewer: who } = await viewer();
  const article = getArticle(slug, who);
  if (!article) notFound();
  const topic = helpTopics.find((t) => t.slug === article.topic);
  const related = relatedArticles(article, who);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
        <Link href="/help" className="hover:text-brand-ink">
          Help centre
        </Link>
        {topic && (
          <>
            {' / '}
            <Link href={`/help#${topic.slug}`} className="hover:text-brand-ink">
              {topic.title}
            </Link>
          </>
        )}
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{article.title}</h1>
      <p className="mt-3 text-lg text-gray-700">{article.summary}</p>

      <article className="mt-8 bg-white p-6 shadow-md sm:p-8">
        <RichText text={article.body} size="lg" className="text-base md:text-lg" />
      </article>

      <div className="mt-8">
        <HelpFeedback slug={article.slug} signedIn={Boolean(session)} />
      </div>

      {related.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-bold">Related articles</h2>
          <ul className="divide-y divide-gray-200 bg-white shadow-md">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/help/${r.slug}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <span className="font-semibold">{r.title}</span>
                  <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

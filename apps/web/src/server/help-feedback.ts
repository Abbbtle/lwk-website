import 'server-only';
import { helpArticles } from '@/content/help';
import { getDb } from './db';

// "Was this helpful?" answers on help articles, so staff can see which articles need work.

export async function recordHelpFeedback(input: {
  slug: string;
  helpful: boolean;
  comment?: string;
  userId?: string;
}) {
  if (!helpArticles.some((a) => a.slug === input.slug)) return;
  await getDb().helpFeedback.create({
    data: {
      articleSlug: input.slug,
      helpful: input.helpful,
      comment: input.comment?.trim() || null,
      userId: input.userId ?? null,
    },
  });
}

/** Articles with the most "not helpful" answers in the last 30 days, with recent comments. */
export async function helpFeedbackSummary() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await getDb().helpFeedback.groupBy({
    by: ['articleSlug', 'helpful'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const bySlug = new Map<string, { helpful: number; notHelpful: number }>();
  for (const row of rows) {
    const entry = bySlug.get(row.articleSlug) ?? { helpful: 0, notHelpful: 0 };
    if (row.helpful) entry.helpful += row._count._all;
    else entry.notHelpful += row._count._all;
    bySlug.set(row.articleSlug, entry);
  }
  const comments = await getDb().helpFeedback.findMany({
    where: { createdAt: { gte: since }, helpful: false, comment: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { articleSlug: true, comment: true, createdAt: true },
  });
  const title = (slug: string) => helpArticles.find((a) => a.slug === slug)?.title ?? slug;
  return {
    articles: [...bySlug.entries()]
      .map(([slug, counts]) => ({ slug, title: title(slug), ...counts }))
      .sort((a, b) => b.notHelpful - a.notHelpful || b.helpful - a.helpful)
      .slice(0, 8),
    comments: comments.map((c) => ({ ...c, title: title(c.articleSlug) })),
  };
}

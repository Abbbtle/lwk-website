import { describe, expect, it } from 'vitest';
import { helpArticles, helpTopics } from '@/content/help';
import { parseBlocks, safeHref } from '@/components/rich-text';
import { articlesForPath, getArticle, searchHelp, topicsFor } from './help';

const learner = { staff: false };
const staff = { staff: true };
const slugs = (articles: { slug: string }[]) => articles.map((a) => a.slug);

describe('help content', () => {
  it('has unique slugs, known topics and working internal links', () => {
    const all = new Set(helpArticles.map((a) => a.slug));
    expect(all.size).toBe(helpArticles.length);
    const topics = new Set(helpTopics.map((t) => t.slug));
    for (const article of helpArticles) {
      expect(topics.has(article.topic), article.slug).toBe(true);
      expect(article.summary.length, article.slug).toBeLessThanOrEqual(160);
      for (const [, href] of article.body.matchAll(/\]\(([^)]+)\)/g)) {
        expect(safeHref(href), `${article.slug}: ${href}`).not.toBeNull();
        if (href.startsWith('/help/')) expect(all.has(href.slice(6)), href).toBe(true);
      }
      // Renders without tables or other unsupported blocks.
      expect(parseBlocks(article.body).length).toBeGreaterThan(0);
      expect(article.body).not.toMatch(/^\|/m);
    }
  });
});

describe('finding help', () => {
  it('keeps staff articles for staff', () => {
    expect(getArticle('handling-support-requests', learner)).toBeUndefined();
    expect(getArticle('handling-support-requests', staff)).toBeDefined();
    expect(topicsFor(learner).some((t) => t.slug === 'staff')).toBe(false);
  });

  it('suggests articles for the page, most specific first', () => {
    expect(slugs(articlesForPath('/learn/kirtan-basics/abc', learner))).toEqual(
      expect.arrayContaining(['using-the-lesson-player', 'video-or-pdf-will-not-load']),
    );
    expect(slugs(articlesForPath('/account/security?x=1', learner))[0]).toMatch(
      /two-step|changing-your-password/,
    );
    expect(slugs(articlesForPath('/admin/users/1', staff))).toContain('managing-users-and-roles');
    expect(articlesForPath('/admin/users/1', learner)).toHaveLength(0);
  });

  it('answers common questions with the right article first', () => {
    expect(searchHelp('I forgot my password', learner)[0].slug).toBe('resetting-your-password');
    expect(searchHelp('how do I turn on 2fa', learner)[0].slug).toBe('two-step-verification');
    expect(searchHelp('video not playing', learner)[0].slug).toBe('video-or-pdf-will-not-load');
    expect(searchHelp('delete my account', learner)[0].slug).toBe('your-data-and-privacy');
    expect(searchHelp('become a teacher', learner)[0].slug).toBe('becoming-an-instructor');
    expect(searchHelp('the', learner)).toEqual([]);
  });
});

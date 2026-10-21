import { describe, expect, it } from 'vitest';
import { helpArticles, helpTopics } from '@/content/help';
import { parseBlocks, safeHref } from '@/components/rich-text';
import type { SalesMoment } from '@/lib/early-access';
import { articlesForPath, getArticle, searchHelp, topicsFor } from './help';

const EARLY: SalesMoment = { phase: 'early_access', earlyAccessEndsAt: null };
const ENDING: SalesMoment = {
  phase: 'early_access',
  earlyAccessEndsAt: new Date('2027-03-01T00:00:00+02:00'),
};
const AFTER: SalesMoment = { phase: 'paid', earlyAccessEndsAt: ENDING.earlyAccessEndsAt };

const learner = { staff: false, moment: EARLY };
const staff = { staff: true, moment: EARLY };
const slugs = (articles: { slug: string }[]) => articles.map((a) => a.slug);

describe('help content', () => {
  it.each([
    ['during early access', EARLY],
    ['once its end is set', ENDING],
    ['after early access', AFTER],
  ])('has unique slugs, known topics and working internal links %s', (_when, moment) => {
    const articles = helpArticles(moment);
    const all = new Set(articles.map((a) => a.slug));
    expect(all.size).toBe(articles.length);
    const topics = new Set(helpTopics.map((t) => t.slug));
    for (const article of articles) {
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

describe('articles about prices and early access', () => {
  const text = (slug: string, moment: SalesMoment) => {
    const article = getArticle(slug, { staff: true, moment })!;
    return `${article.summary}\n${article.body}`;
  };
  const priced = ['enrolling-in-a-course', 'prices-and-plans', 'offering-a-free-course'];

  it('say every course is free while early access lasts, with its end once set', () => {
    expect(text('prices-and-plans', EARLY)).toContain('Paid plans open soon');
    expect(text('prices-and-plans', ENDING)).toContain('Paid plans open on 1 March 2027.');
    expect(text('enrolling-in-a-course', ENDING)).toContain('Early access ends on 1 March 2027.');
    for (const slug of priced) {
      expect(text(slug, EARLY), slug).toMatch(/every course is free/i);
    }
  });

  it('say how paid plans work once early access has ended', () => {
    for (const slug of priced) {
      const after = text(slug, AFTER);
      expect(after, slug).not.toMatch(/every course is free|paid plans open|open soon/i);
    }
    expect(text('prices-and-plans', AFTER)).toContain(
      'the courses you joined during early access stay yours',
    );
    expect(text('enrolling-in-a-course', AFTER)).toContain('[Membership](/plans-and-pricing)');
  });

  it('never say every course is free in an article that does not follow the phase', () => {
    const fixed = helpArticles(AFTER).filter((a) => !priced.includes(a.slug));
    for (const article of fixed) {
      expect(`${article.summary} ${article.body}`, article.slug).not.toMatch(
        /every course is free|during early access/i,
      );
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
    expect(slugs(articlesForPath('/plans-and-pricing', learner))[0]).toBe('prices-and-plans');
    expect(articlesForPath('/admin/users/1', learner)).toHaveLength(0);
  });

  it('answers common questions with the right article first', () => {
    expect(searchHelp('I forgot my password', learner)[0].slug).toBe('resetting-your-password');
    expect(searchHelp('how do I turn on 2fa', learner)[0].slug).toBe('two-step-verification');
    expect(searchHelp('video not playing', learner)[0].slug).toBe('video-or-pdf-will-not-load');
    expect(searchHelp('delete my account', learner)[0].slug).toBe('your-data-and-privacy');
    expect(searchHelp('become a teacher', learner)[0].slug).toBe('becoming-an-instructor');
    expect(searchHelp('How do I create an account?', learner)[0].slug).toBe(
      'creating-your-account',
    );
    expect(searchHelp('deleting my account', learner)[0].slug).toBe('your-data-and-privacy');
    expect(searchHelp('How much does a membership cost?', learner)[0].slug).toBe(
      'prices-and-plans',
    );
    expect(searchHelp('can I cancel my subscription', learner)[0].slug).toBe('prices-and-plans');
    expect(searchHelp('the', learner)).toEqual([]);
  });
});

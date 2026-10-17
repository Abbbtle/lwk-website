import { type HelpArticle, helpArticles, helpTopics } from '@/content/help';

// Finding help articles: who may see them, which fit the current page, and search.

export type HelpViewer = { staff: boolean };

export function visibleTo(article: HelpArticle, viewer: HelpViewer) {
  return article.audience !== 'staff' || viewer.staff;
}

export function visibleArticles(viewer: HelpViewer) {
  return helpArticles.filter((article) => visibleTo(article, viewer));
}

export function getArticle(slug: string, viewer: HelpViewer) {
  const article = helpArticles.find((a) => a.slug === slug);
  return article && visibleTo(article, viewer) ? article : undefined;
}

export function topicsFor(viewer: HelpViewer) {
  return helpTopics
    .map((topic) => ({
      ...topic,
      articles: visibleArticles(viewer).filter((a) => a.topic === topic.slug),
    }))
    .filter((topic) => topic.articles.length > 0);
}

/** How well an article's path pattern fits a page: exact beats prefix; longer prefixes win. */
function pathScore(pattern: string, path: string): number {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix) ? prefix.length : 0;
  }
  return pattern === path ? 1000 + pattern.length : 0;
}

/** Articles about the page at `path`, most specific first. */
export function articlesForPath(path: string, viewer: HelpViewer, limit = 4) {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return visibleArticles(viewer)
    .map((article) => ({
      article,
      score: Math.max(0, ...article.paths.map((pattern) => pathScore(pattern, clean))),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.article);
}

const STOP_WORDS = new Set(
  'a an and are as at be but by can do does for from get got have how i if in into is it its me my of on or so that the their them there this to up was we what when where which who why will with you your'.split(
    ' ',
  ),
);

/** A rough stem, so "create" also finds "creating" and "deleting" finds "delete". */
function stem(word: string) {
  for (const suffix of ['ing', 'ed', 'es', 's', 'e']) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function terms(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
    .map(stem);
}

/** Ranks articles by how well they match the question; best first. */
export function searchHelp(query: string, viewer: HelpViewer, limit = 8) {
  const wanted = [...new Set(terms(query))];
  if (wanted.length === 0) return [];
  const phrase = query.trim().toLowerCase();
  return visibleArticles(viewer)
    .map((article) => {
      const title = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();
      const keywords = article.keywords.join(' | ').toLowerCase();
      const body = article.body.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const term of wanted) {
        let termScore = 0;
        if (title.includes(term)) termScore += 6;
        if (keywords.includes(term)) termScore += 5;
        if (summary.includes(term)) termScore += 3;
        if (body.includes(term)) termScore += 1;
        if (termScore > 0) matched++;
        score += termScore;
      }
      if (article.keywords.some((k) => phrase.includes(k.toLowerCase()))) score += 8;
      // Prefer articles that cover more of the question's words.
      score *= matched / wanted.length;
      return { article, score };
    })
    .filter((match) => match.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => match.article);
}

/** Other articles on the same topic. */
export function relatedArticles(article: HelpArticle, viewer: HelpViewer, limit = 3) {
  return visibleArticles(viewer)
    .filter((a) => a.topic === article.topic && a.slug !== article.slug)
    .slice(0, limit);
}

/** The first articles people usually need. */
export const POPULAR_ARTICLES = [
  'finding-your-way-around',
  'using-the-lesson-player',
  'resetting-your-password',
  'free-content-in-explore',
  'contacting-support',
];

export function popularArticles(viewer: HelpViewer) {
  return POPULAR_ARTICLES.map((slug) => getArticle(slug, viewer)).filter((a): a is HelpArticle =>
    Boolean(a),
  );
}

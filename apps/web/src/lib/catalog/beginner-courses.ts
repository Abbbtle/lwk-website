import type { Category, CourseSummary } from './types';

/**
 * Up to `limit` beginner courses, taking one from each category in turn (free courses first), so
 * every category gets a place before any category gets a second. Works for any number of
 * categories.
 */
export function beginnerCourses(
  categories: Pick<Category, 'slug'>[],
  courses: CourseSummary[],
  limit: number,
): CourseSummary[] {
  const byCategory = categories.map(({ slug }) =>
    courses
      .filter((course) => course.categorySlug === slug && course.level === 'Beginner')
      .sort((a, b) => Number(b.isFree) - Number(a.isFree)),
  );
  const picked: CourseSummary[] = [];
  for (let round = 0; byCategory.some((list) => list.length > round); round++) {
    for (const list of byCategory) {
      if (picked.length === limit) return picked;
      if (list[round]) picked.push(list[round]);
    }
  }
  return picked;
}

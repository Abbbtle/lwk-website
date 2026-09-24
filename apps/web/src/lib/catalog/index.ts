// Catalogue queries. Async so pages keep the same shape when the database arrives in Phase 2.
import { categories, courses } from './sample-data';
import type { Category, Course, CourseSummary } from './types';

export type { Category, Course, CourseSummary, Level, Section } from './types';

function summarise(course: Course): CourseSummary {
  const category = categories.find((c) => c.slug === course.categorySlug);
  if (!category) throw new Error(`Unknown category ${course.categorySlug} for ${course.slug}`);
  return {
    ...course,
    category,
    lessonCount: course.sections.reduce((sum, s) => sum + s.lessonCount, 0),
    durationMinutes: course.sections.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}

export async function getCategories(): Promise<(Category & { courseCount: number })[]> {
  return categories.map((category) => ({
    ...category,
    courseCount: courses.filter((c) => c.categorySlug === category.slug).length,
  }));
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return categories.find((c) => c.slug === slug);
}

export async function searchCourses({
  query,
  category,
}: {
  query?: string;
  category?: string;
} = {}): Promise<CourseSummary[]> {
  const terms = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return courses
    .filter((c) => !category || c.categorySlug === category)
    .map(summarise)
    .filter((c) => {
      const haystack = `${c.title} ${c.subtitle} ${c.category.name}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
}

export async function getCourse(slug: string): Promise<CourseSummary | undefined> {
  const course = courses.find((c) => c.slug === slug);
  return course && summarise(course);
}

export async function getCourseSlugs(): Promise<string[]> {
  return courses.map((c) => c.slug);
}

import { describe, expect, it } from 'vitest';
import { beginnerCourses } from './beginner-courses';
import type { CourseSummary, Level } from './types';

function course(slug: string, categorySlug: string, level: Level, isFree = false) {
  return { slug, categorySlug, level, isFree } as CourseSummary;
}

const slugs = (courses: CourseSummary[]) => courses.map((c) => c.slug);

describe('beginner courses', () => {
  const categories = [{ slug: 'kirtan' }, { slug: 'prasadam' }, { slug: 'sastra-study' }];
  const courses = [
    course('advanced-kirtan', 'kirtan', 'Advanced'),
    course('history-of-kirtan', 'kirtan', 'Beginner'),
    course('kirtan-basics', 'kirtan', 'Beginner', true),
    course('prasadam-cooking', 'prasadam', 'Beginner'),
    course('healthy-cooking', 'prasadam', 'Beginner'),
    course('gita-deep-dive', 'sastra-study', 'Advanced'),
  ];

  it('takes one beginner course per category in turn, free courses first', () => {
    expect(slugs(beginnerCourses(categories, courses, 10))).toEqual([
      'kirtan-basics',
      'prasadam-cooking',
      'history-of-kirtan',
      'healthy-cooking',
    ]);
  });

  it('stops at the limit', () => {
    expect(slugs(beginnerCourses(categories, courses, 3))).toEqual([
      'kirtan-basics',
      'prasadam-cooking',
      'history-of-kirtan',
    ]);
  });

  it('works for any number of categories', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ slug: `category-${i}` }));
    const oneEach = many.map(({ slug }) => course(`${slug}-intro`, slug, 'Beginner'));
    expect(beginnerCourses(many, oneEach, 6)).toHaveLength(6);
    expect(beginnerCourses([], oneEach, 6)).toEqual([]);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import { getCategories, getCategory, getCourse, searchCourses } from './catalog';
import { getDb } from './db';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('getCategories', () => {
  it('returns categories in display order with published course counts', async () => {
    const categories = await getCategories();
    expect(categories.map((c) => c.slug)).toEqual([
      'kirtan',
      'prasadam',
      'vaisnava-etiquette',
      'sastra-study',
    ]);
    expect(categories.every((c) => c.courseCount === 5)).toBe(true);
  });

  it('looks up a single category by slug', async () => {
    expect((await getCategory('prasadam'))?.name).toBe('Prasadam');
    expect(await getCategory('missing')).toBeUndefined();
  });
});

describe('searchCourses', () => {
  it('returns every published course when unfiltered', async () => {
    expect(await searchCourses()).toHaveLength(20);
  });

  it('filters by category', async () => {
    const courses = await searchCourses({ category: 'kirtan' });
    expect(courses).toHaveLength(5);
    expect(courses.every((c) => c.categorySlug === 'kirtan')).toBe(true);
  });

  it('matches every term, case-insensitively, across title and category', async () => {
    const slugs = async (query: string) => (await searchCourses({ query })).map((c) => c.slug);
    expect(await slugs('HARMONIUM')).toEqual(['mastering-harmonium']);
    expect(await slugs('kirtan leadership')).toEqual(['kirtan-leadership']);
    expect(await slugs('sastra')).toHaveLength(5);
    expect(await slugs('no-such-course')).toEqual([]);
  });

  it('combines search with a category filter', async () => {
    const courses = await searchCourses({ query: 'advanced', category: 'kirtan' });
    expect(courses.map((c) => c.slug)).toEqual(['advanced-kirtan-techniques']);
  });
});

describe('getCourse', () => {
  it('returns the course with curriculum totals computed from lessons', async () => {
    const course = await getCourse('mastering-harmonium');
    expect(course).toMatchObject({
      title: 'Mastering Harmonium',
      level: 'Intermediate',
      priceUsd: 30,
      lessonCount: 20,
      durationMinutes: 210,
      category: { slug: 'kirtan' },
    });
    expect(course?.sections.map((s) => s.title)).toEqual([
      'Getting to know the harmonium',
      'Drones and basic chords',
      'Playing the melody',
      'Accompanying a leader',
    ]);
  });

  it('returns undefined for an unknown slug', async () => {
    expect(await getCourse('no-such-course')).toBeUndefined();
  });
});

describe('unpublished courses', () => {
  it('are hidden from search, lookups and category counts', async () => {
    const db = getDb();
    const category = await db.category.findUniqueOrThrow({ where: { slug: 'kirtan' } });
    const draft = await db.course.create({
      data: {
        slug: 'draft-kirtan-course',
        title: 'Draft Kirtan Course',
        subtitle: 'Not ready yet',
        description: 'Draft',
        level: 'BEGINNER',
        status: 'DRAFT',
        instructorName: 'Test',
        categoryId: category.id,
      },
    });
    try {
      expect(await getCourse(draft.slug)).toBeUndefined();
      expect((await searchCourses({ query: 'draft' })).map((c) => c.slug)).toEqual([]);
      const kirtan = (await getCategories()).find((c) => c.slug === 'kirtan');
      expect(kirtan?.courseCount).toBe(5);
    } finally {
      await db.course.delete({ where: { id: draft.id } });
    }
  });
});

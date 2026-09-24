import 'server-only';
import type { CourseLevel, Prisma } from '@/generated/prisma/client';
import type { Category, CourseSummary, Level } from '@/lib/catalog/types';
import { getDb } from './db';

const levelLabels: Record<CourseLevel, Level> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

// Only published courses are visible in the public catalogue.
const published = { status: 'PUBLISHED' } satisfies Prisma.CourseWhereInput;

const courseInclude = {
  category: true,
  sections: {
    orderBy: { position: 'asc' },
    include: { lessons: { select: { durationSeconds: true } } },
  },
} satisfies Prisma.CourseInclude;

type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;
type CategoryRow = Prisma.CategoryGetPayload<object>;

function toCategory(row: CategoryRow): Category {
  return {
    slug: row.slug,
    name: row.name,
    headline: row.headline,
    description: row.description,
  };
}

function toCourseSummary(row: CourseRow): CourseSummary {
  const sections = row.sections.map((s) => ({
    title: s.title,
    lessonCount: s.lessons.length,
    durationMinutes: Math.round(s.lessons.reduce((sum, l) => sum + l.durationSeconds, 0) / 60),
  }));
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    categorySlug: row.category.slug,
    category: toCategory(row.category),
    instructor: row.instructorName,
    level: levelLabels[row.level],
    // Prices are optional until pricing is decided; the UI hides a missing price.
    priceUsd: row.priceCents === null ? null : row.priceCents / 100,
    outcomes: row.outcomes,
    sections,
    lessonCount: sections.reduce((sum, s) => sum + s.lessonCount, 0),
    durationMinutes: sections.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}

export async function getCategories(): Promise<(Category & { courseCount: number })[]> {
  const rows = await getDb().category.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { courses: { where: published } } } },
  });
  return rows.map((row) => ({ ...toCategory(row), courseCount: row._count.courses }));
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const row = await getDb().category.findUnique({ where: { slug } });
  return row ? toCategory(row) : undefined;
}

/** Every search term must match the title, subtitle or category name (case-insensitive). */
export async function searchCourses({
  query,
  category,
}: { query?: string; category?: string } = {}): Promise<CourseSummary[]> {
  const terms = (query ?? '').split(/\s+/).filter(Boolean).slice(0, 10);
  const rows = await getDb().course.findMany({
    where: {
      ...published,
      ...(category && { category: { slug: category } }),
      AND: terms.map((term) => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { subtitle: { contains: term, mode: 'insensitive' } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
        ],
      })),
    },
    include: courseInclude,
    orderBy: [{ category: { position: 'asc' } }, { publishedAt: 'asc' }, { title: 'asc' }],
  });
  return rows.map(toCourseSummary);
}

export async function getCourse(slug: string): Promise<CourseSummary | undefined> {
  const row = await getDb().course.findFirst({
    where: { ...published, slug },
    include: courseInclude,
  });
  return row ? toCourseSummary(row) : undefined;
}

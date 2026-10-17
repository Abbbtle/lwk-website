// Loads the sample catalogue. Safe to re-run: categories and courses are upserted by slug
// and each course's sections and lessons are replaced.
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { type CourseLevel, PrismaClient } from '../src/generated/prisma/client';
import type { Level } from '../src/lib/catalog/types';
import { categories, courses } from './seed-data';

config({ path: ['.env.local', '.env'], quiet: true });

const levels: Record<Level, CourseLevel> = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
};

/** Split a section's total minutes into per-lesson seconds that add up exactly. */
function lessonDurations(lessonCount: number, totalMinutes: number): number[] {
  const total = totalMinutes * 60;
  const base = Math.floor(total / lessonCount);
  return Array.from({ length: lessonCount }, (_, i) =>
    i === lessonCount - 1 ? total - base * (lessonCount - 1) : base,
  );
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const categoryIds = new Map<string, string>();
    for (const [position, c] of categories.entries()) {
      const data = { name: c.name, headline: c.headline, description: c.description, position };
      const row = await db.category.upsert({
        where: { slug: c.slug },
        create: { slug: c.slug, ...data },
        update: data,
      });
      categoryIds.set(c.slug, row.id);
    }

    for (const c of courses) {
      const data = {
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        outcomes: c.outcomes,
        level: levels[c.level],
        status: 'PUBLISHED' as const,
        instructorName: c.instructor,
        priceCents: c.priceUsd === null ? null : c.priceUsd * 100,
        categoryId: categoryIds.get(c.categorySlug)!,
        publishedAt: new Date('2024-01-01T00:00:00Z'),
      };
      await db.$transaction(async (tx) => {
        const course = await tx.course.upsert({
          where: { slug: c.slug },
          create: { slug: c.slug, ...data },
          update: data,
        });
        await tx.section.deleteMany({ where: { courseId: course.id } });
        for (const [sectionIndex, s] of c.sections.entries()) {
          await tx.section.create({
            data: {
              courseId: course.id,
              title: s.title,
              position: sectionIndex,
              lessons: {
                create: lessonDurations(s.lessonCount, s.durationMinutes).map(
                  (durationSeconds, lessonIndex) => ({
                    title: `Lesson ${lessonIndex + 1}`,
                    type: 'VIDEO' as const,
                    position: lessonIndex,
                    durationSeconds,
                    // The first lesson of each course is a free preview.
                    isPreview: sectionIndex === 0 && lessonIndex === 0,
                  }),
                ),
              },
            },
          });
        }
      });
    }

    console.log(`Seeded ${categories.length} categories and ${courses.length} courses.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

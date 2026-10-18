import type { CourseTier } from '@/lib/pricing';

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export type Category = {
  slug: string;
  name: string;
  /** Short line used on cards and the home page, e.g. "Rediscover Kirtan". */
  headline: string;
  description: string;
};

export type Section = {
  title: string;
  lessonCount: number;
  durationMinutes: number;
};

export type Course = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  instructor: string;
  level: Level;
  /** Price tier for buying the course on its own; null for free courses and until one is chosen. */
  priceTier: CourseTier | null;
  outcomes: string[];
  sections: Section[];
};

export type CourseSummary = Course & {
  category: Category;
  lessonCount: number;
  durationMinutes: number;
  /** Short-lived link to the uploaded cover image, if any. */
  coverUrl: string | null;
  /** First free-preview lesson, if any. */
  previewLessonId: string | null;
  /** Free for everyone (listed in Explore). */
  isFree: boolean;
  /** Sample content for testing. */
  isSample: boolean;
};

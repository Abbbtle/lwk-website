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
  priceUsd: number;
  outcomes: string[];
  sections: Section[];
};

export type CourseSummary = Course & {
  category: Category;
  lessonCount: number;
  durationMinutes: number;
};

import { z } from 'zod';
import { optionalText, requiredText } from './form-state';

export const levelOptions = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
] as const;

export const lessonTypeOptions = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF document' },
  { value: 'TEXT', label: 'Text' },
] as const;

const slug = z.string().regex(/^[a-z0-9-]{1,60}$/, 'Choose a category.');

export const newCourseSchema = z.object({
  title: requiredText('Title', 120),
  categorySlug: slug,
});

export const courseDetailsSchema = z.object({
  title: requiredText('Title', 120),
  subtitle: optionalText(200),
  description: optionalText(5000),
  categorySlug: slug,
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], { error: 'Choose a level.' }),
  instructorName: requiredText('Instructor name', 120),
  // One outcome per line in the form.
  outcomes: z
    .string()
    .max(3000)
    .optional()
    .transform((text) =>
      (text ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(200, 'Keep each outcome under 200 characters.')).max(12)),
});

export type NewCourseInput = z.infer<typeof newCourseSchema>;
export type CourseDetailsInput = z.infer<typeof courseDetailsSchema>;

export const lessonSchema = z.object({
  title: requiredText('Lesson title', 150),
  type: z.enum(['VIDEO', 'PDF', 'TEXT']),
  body: optionalText(50000),
  isPreview: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
  durationMinutes: z.coerce.number().int().min(0).max(600).default(0),
});

export type LessonInput = z.infer<typeof lessonSchema>;

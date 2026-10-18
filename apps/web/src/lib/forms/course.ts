import { z } from 'zod';
import { joinParts } from '@/lib/format';
import {
  COURSE_TIERS,
  type CoursePricing,
  coursePrice,
  courseTierTitle,
  formatMoney,
} from '@/lib/pricing';
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

// The price field holds "free", a tier ("1" to "5"), or nothing while the course is unpriced.
const FREE = 'free';

// Options show a tier's prices for these regions. The rest of the world is left out: a second
// dollar amount would read as ambiguous.
const optionRegions = ['south-africa', 'high-income', 'india'] as const;

/** "Free", then "Tier 2 · Standard · R199 · $19.99 · ₹549" and so on for each tier. */
export const priceOptions = [
  { value: FREE, label: 'Free' },
  ...COURSE_TIERS.map((tier) => ({
    value: String(tier),
    label: joinParts([
      courseTierTitle(tier),
      ...optionRegions.map((region) => formatMoney(coursePrice(tier, region))),
    ]),
  })),
];

/** The price field's value for a course's pricing; the form schema reads it back. */
export function priceFieldValue(pricing: CoursePricing): string {
  switch (pricing.kind) {
    case 'free':
      return FREE;
    case 'tier':
      return String(pricing.tier);
    case 'unpriced':
      return '';
  }
}

function toCoursePricing(value: string | undefined): CoursePricing {
  if (value === FREE) return { kind: 'free' };
  const tier = COURSE_TIERS.find((option) => String(option) === value);
  return tier === undefined ? { kind: 'unpriced' } : { kind: 'tier', tier };
}

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
  // Browsers leave the field out while the "Choose a price" placeholder is selected.
  price: z
    .enum(['', ...priceOptions.map((option) => option.value)], { error: 'Choose a price.' })
    .optional()
    .transform(toCoursePricing),
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

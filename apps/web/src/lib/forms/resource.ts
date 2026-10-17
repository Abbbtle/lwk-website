import { z } from 'zod';
import { optionalText, requiredText } from './form-state';

export const resourceTypeOptions = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio recording' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'PDF', label: 'PDF document' },
] as const;

export type ResourceTypeValue = (typeof resourceTypeOptions)[number]['value'];

const resourceType = z.enum(['VIDEO', 'AUDIO', 'ARTICLE', 'PDF'], { error: 'Choose a type.' });
// Empty means "no category".
const categorySlug = z
  .string()
  .regex(/^[a-z0-9-]{0,60}$/)
  .optional()
  .transform((v) => v || undefined);

export const newResourceSchema = z.object({
  title: requiredText('Title', 150),
  type: resourceType,
});

export const resourceDetailsSchema = z.object({
  title: requiredText('Title', 150),
  summary: requiredText('Summary', 300),
  authorName: requiredText('Speaker or author', 120),
  categorySlug,
  body: optionalText(50000),
  durationMinutes: z.coerce.number().int().min(0).max(1440).default(0),
});

export type NewResourceInput = z.infer<typeof newResourceSchema>;
export type ResourceDetailsInput = z.infer<typeof resourceDetailsSchema>;

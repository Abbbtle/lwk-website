import { z } from 'zod';
import { optionalText, requiredText } from './form-state';

export const degreeOptions = [
  'None',
  'High school',
  'Diploma or certificate',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate',
  'Traditional or spiritual training',
] as const;

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .pipe(
    z.url({ protocol: /^https?$/, error: 'Enter a full link starting with https://' }).optional(),
  );

export const instructorApplicationSchema = z.object({
  // Personal information
  fullName: requiredText('Full name', 120),
  initiatedName: optionalText(120),
  email: z.email('Enter a valid email address.').max(254),
  nationality: requiredText('Nationality', 80),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number, including the country code.'),
  linkedIn: optionalUrl,
  website: optionalUrl,
  // Professional background
  expertise: requiredText('Area of expertise', 200),
  experienceYears: z.coerce
    .number({ error: 'Enter your years of experience.' })
    .int('Enter a whole number.')
    .min(0, 'Enter 0 or more.')
    .max(80, 'Enter a number up to 80.'),
  degree: z.enum(degreeOptions, { error: 'Choose your highest degree.' }),
  certifications: optionalText(1000),
  workExperience: requiredText('Work experience', 3000),
  teachingExperience: requiredText('Teaching experience', 3000),
  languages: requiredText('Languages spoken', 300),
  // Motivation
  motivation: requiredText('This answer', 3000),
  philosophy: requiredText('This answer', 3000),
  strengths: requiredText('This answer', 3000),
});

export type InstructorApplication = z.infer<typeof instructorApplicationSchema>;

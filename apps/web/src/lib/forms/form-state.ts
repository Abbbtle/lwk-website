import { z } from 'zod';

export type FormState = {
  status: 'idle' | 'invalid' | 'received';
  message?: string;
  errors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so fields keep their input after a failed submit. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: 'idle' };

/** Read every text field from the form and validate it against the schema. */
export function parseForm<T extends z.ZodType>(schema: T, formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) values[key] = value;
  }
  const result = schema.safeParse(values);
  return { result, values };
}

export function invalid(error: z.ZodError, values: Record<string, string>): FormState {
  return {
    status: 'invalid',
    message: 'Please correct the highlighted fields.',
    errors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
    values,
  };
}

/** Optional text input: blank becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

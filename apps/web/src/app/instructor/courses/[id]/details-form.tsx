'use client';

import { useActionState } from 'react';
import {
  CheckboxField,
  FormStatus,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/form-fields';
import { levelOptions } from '@/lib/forms/course';
import type { FormState } from '@/lib/forms/form-state';
import { updateDetails } from '../../actions';

export function DetailsForm({
  courseId,
  categories,
  values,
  locked,
}: {
  courseId: string;
  categories: { value: string; label: string }[];
  values: Record<string, string>;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateDetails.bind(null, courseId),
    { status: 'idle', values },
  );

  return (
    <form action={formAction} noValidate className="space-y-5">
      <FormStatus state={state} />
      <fieldset disabled={locked} className="space-y-5 disabled:opacity-70">
        <TextField name="title" label="Title" required state={state} />
        <TextField
          name="subtitle"
          label="Subtitle"
          hint="One sentence shown under the title"
          state={state}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="categorySlug"
            label="Category"
            options={categories}
            required
            state={state}
          />
          <SelectField name="level" label="Level" options={levelOptions} required state={state} />
        </div>
        <TextField
          name="instructorName"
          label="Instructor name shown to learners"
          required
          state={state}
        />
        <TextAreaField name="description" label="Description" rows={6} state={state} />
        <TextAreaField
          name="outcomes"
          label="What learners will learn"
          hint="One outcome per line (up to 12)"
          rows={5}
          state={state}
        />
        <CheckboxField
          name="isFree"
          label="Offer this course for free"
          hint="Free courses are listed in Explore and stay free for everyone, also when paid plans start."
          state={state}
        />
        {!locked && (
          <button type="submit" className="btn-solid" disabled={pending}>
            {pending ? 'Saving...' : 'Save details'}
          </button>
        )}
      </fieldset>
    </form>
  );
}

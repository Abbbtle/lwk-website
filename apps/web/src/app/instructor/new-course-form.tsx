'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField, TextField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { createCourse } from './actions';

export function NewCourseForm({ categories }: { categories: { value: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createCourse, initialFormState);
  return (
    <form action={formAction} noValidate className="space-y-4 border border-gray-300 p-6">
      <h2 className="text-xl font-bold">Create a course</h2>
      <FormStatus state={state} />
      <TextField name="title" label="Course title" required state={state} />
      <SelectField
        name="categorySlug"
        label="Category"
        options={categories}
        required
        state={state}
      />
      <button type="submit" className="btn-brand" disabled={pending}>
        {pending ? 'Creating...' : 'Create draft'}
      </button>
    </form>
  );
}

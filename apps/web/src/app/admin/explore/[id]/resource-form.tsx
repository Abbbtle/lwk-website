'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField, TextAreaField, TextField } from '@/components/form-fields';
import type { FormState } from '@/lib/forms/form-state';
import type { ResourceTypeValue } from '@/lib/forms/resource';
import { updateResource } from '../actions';

export function ResourceForm({
  resourceId,
  type,
  categories,
  values,
}: {
  resourceId: string;
  type: ResourceTypeValue;
  categories: { value: string; label: string }[];
  values: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateResource.bind(null, resourceId),
    { status: 'idle', values },
  );
  const article = type === 'ARTICLE';

  return (
    <form action={action} noValidate className="space-y-5">
      <FormStatus state={state} />
      <TextField name="title" label="Title" required state={state} />
      <TextAreaField
        name="summary"
        label="Summary"
        hint="One or two sentences shown on cards and in search results."
        rows={2}
        required
        state={state}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="authorName"
          label={type === 'AUDIO' || type === 'VIDEO' ? 'Speaker or performer' : 'Author'}
          required
          state={state}
        />
        <SelectField
          name="categorySlug"
          label="Category"
          options={[{ value: '', label: 'No category' }, ...categories]}
          placeholder="No category"
          state={state}
        />
      </div>
      {(type === 'VIDEO' || type === 'AUDIO') && (
        <TextField
          name="durationMinutes"
          label="Length in minutes"
          type="number"
          hint="Filled in automatically when you upload; correct it here if needed."
          state={state}
        />
      )}
      <TextAreaField
        name="body"
        label={article ? 'Article text' : 'Description'}
        hint={
          article
            ? 'Blank lines separate paragraphs. Use ## for headings, - for lists, **bold** and [links](https://...).'
            : 'Shown below the player. Same formatting as articles.'
        }
        rows={article ? 18 : 6}
        required={article}
        state={state}
      />
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

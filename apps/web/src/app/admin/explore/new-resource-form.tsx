'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField, TextField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { resourceTypeOptions } from '@/lib/forms/resource';
import { createResource } from './actions';

export function NewResourceForm() {
  const [state, action, pending] = useActionState(createResource, initialFormState);
  return (
    <form action={action} noValidate className="space-y-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField name="title" label="Title" required state={state} />
        <SelectField
          name="type"
          label="Type"
          options={resourceTypeOptions}
          required
          state={state}
        />
      </div>
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Creating...' : 'Create draft'}
      </button>
    </form>
  );
}

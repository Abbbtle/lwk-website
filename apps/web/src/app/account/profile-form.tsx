'use client';

import { useActionState } from 'react';
import { FormStatus, TextField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { updateName } from './actions';

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateName, {
    ...initialFormState,
    values: { name },
  });
  return (
    <form action={action} className="space-y-5">
      <FormStatus state={state} />
      <TextField
        name="name"
        label="Display name"
        autoComplete="name"
        hint="Shown in the site menu and, if you teach, on your courses."
        state={state}
        required
      />
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

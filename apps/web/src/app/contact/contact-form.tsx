'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField, TextAreaField, TextField } from '@/components/form-fields';
import { inquiryTypes } from '@/lib/forms/contact';
import { initialFormState } from '@/lib/forms/form-state';
import { submitContact } from './actions';

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialFormState);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <FormStatus state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Name" autoComplete="name" required state={state} />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          state={state}
        />
      </div>
      <TextField name="company" label="Company" autoComplete="organization" state={state} />
      <SelectField
        name="inquiryType"
        label="Nature of Inquiry"
        options={inquiryTypes}
        required
        state={state}
      />
      <TextAreaField name="message" label="Message" rows={6} required state={state} />
      <button type="submit" className="btn-solid" disabled={pending}>
        {pending ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}

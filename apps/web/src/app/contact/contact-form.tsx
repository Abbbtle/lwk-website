'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField, TextAreaField, TextField } from '@/components/form-fields';
import { inquiryTypes } from '@/lib/forms/contact';
import { initialFormState } from '@/lib/forms/form-state';
import { submitContact } from './actions';

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialFormState);
  const common = { state, variant: 'underline' as const };

  return (
    <form action={formAction} noValidate className="space-y-8">
      <FormStatus state={state} />
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-4">
        <TextField name="name" label="Name" autoComplete="name" required {...common} />
        <TextField name="company" label="Company" autoComplete="organization" {...common} />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          {...common}
        />
        <SelectField
          name="inquiryType"
          label="Nature of Inquiry"
          options={inquiryTypes}
          required
          {...common}
        />
      </div>
      <TextAreaField name="message" label="Message" rows={4} required {...common} />
      <button type="submit" className="btn-outline" disabled={pending}>
        {pending ? 'Sending...' : 'Submit'}
      </button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { FormStatus, TextAreaField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { replyToRequest } from '../actions';

export function ReplyForm({ ticketNumber }: { ticketNumber: number }) {
  const [state, action, pending] = useActionState(
    replyToRequest.bind(null, ticketNumber),
    initialFormState,
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <FormStatus state={state} />
      <TextAreaField name="body" label="Your reply" rows={4} required state={state} />
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Sending...' : 'Send reply'}
      </button>
    </form>
  );
}

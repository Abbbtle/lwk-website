'use client';

import { useActionState } from 'react';
import { FormStatus, SelectField } from '@/components/form-fields';
import type { FormState } from '@/lib/forms/form-state';
import { saveTicketDetails } from '../actions';

export function TicketDetailsForm({
  ticketNumber,
  values,
  staff,
  statuses,
  priorities,
}: {
  ticketNumber: number;
  values: Record<string, string>;
  staff: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  priorities: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveTicketDetails.bind(null, ticketNumber),
    { status: 'idle', values },
  );
  return (
    <form action={action} className="space-y-4">
      <FormStatus state={state} />
      <SelectField name="status" label="Status" options={statuses} required state={state} />
      <SelectField name="priority" label="Priority" options={priorities} required state={state} />
      <SelectField
        name="assigneeId"
        label="Assigned to"
        options={[{ value: '', label: 'Nobody' }, ...staff]}
        placeholder="Nobody"
        state={state}
      />
      <button type="submit" disabled={pending} className="btn-outline w-full disabled:opacity-60">
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

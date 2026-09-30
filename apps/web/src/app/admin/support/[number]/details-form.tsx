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
    { status: 'idle' },
  );
  // Show the saved values (they change when a reply sets the status), except after a failed
  // save, when the person's own choices stay. Each field starts afresh when its saved value
  // changes; the form itself stays, so its "Saved." message does too.
  const shown: FormState = {
    ...state,
    values: state.status === 'invalid' ? { ...values, ...state.values } : values,
  };
  return (
    <form action={action} className="space-y-4">
      <FormStatus state={state} />
      <SelectField
        key={`status-${values.status}`}
        name="status"
        label="Status"
        options={statuses}
        required
        state={shown}
      />
      <SelectField
        key={`priority-${values.priority}`}
        name="priority"
        label="Priority"
        options={priorities}
        required
        state={shown}
      />
      <SelectField
        key={`assignee-${values.assigneeId}`}
        name="assigneeId"
        label="Assigned to"
        options={[{ value: '', label: 'Nobody' }, ...staff]}
        placeholder="Nobody"
        state={shown}
      />
      <button type="submit" disabled={pending} className="btn-outline w-full disabled:opacity-60">
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

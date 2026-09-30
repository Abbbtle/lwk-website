'use client';

import { useActionState, useRef, useState } from 'react';
import { FormStatus } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { staffReply } from '../actions';

// Starting points for common answers; staff edit them before sending.
const TEMPLATES = [
  {
    label: 'Asking for details',
    text: 'Thank you for getting in touch. To help us look into this, could you tell us:\n\n- which page you were on\n- what you expected to happen, and what happened instead\n- your device and browser',
  },
  {
    label: 'Password reset',
    text: 'You can reset your password yourself: on the log in page choose **Forgot password?** and follow the code we email you. [Step-by-step guide](/help/resetting-your-password).',
  },
  {
    label: 'Two-step verification reset done',
    text: 'We have reset two-step verification on your account. You can now log in with just your password. Please set it up again under [Account > Security](/account/security).',
  },
  {
    label: 'Fixed, please check',
    text: 'Thank you for letting us know. This should now be fixed. Could you try again and tell us whether it works for you?',
  },
];

export function StaffReplyForm({ ticketNumber }: { ticketNumber: number }) {
  const [state, action, pending] = useActionState(
    staffReply.bind(null, ticketNumber),
    initialFormState,
  );
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const body = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={action} noValidate className="space-y-4">
      <FormStatus state={state} />
      <div role="radiogroup" aria-label="Message type" className="flex gap-2">
        {(['reply', 'note'] as const).map((value) => (
          <label
            key={value}
            className={`cursor-pointer border px-4 py-2 text-sm font-semibold ${
              mode === value
                ? value === 'note'
                  ? 'border-yellow-600 bg-yellow-100'
                  : 'border-black bg-black text-white'
                : 'border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="sr-only"
            />
            {value === 'reply' ? 'Reply to them' : 'Internal note'}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="template">Insert a template:</label>
        <select
          id="template"
          defaultValue=""
          onChange={(e) => {
            const template = TEMPLATES.find((t) => t.label === e.target.value);
            if (template && body.current) {
              body.current.value = body.current.value
                ? `${body.current.value}\n\n${template.text}`
                : template.text;
              body.current.focus();
            }
            e.target.value = '';
          }}
          className="border border-gray-300 bg-white px-2 py-1"
        >
          <option value="">Choose...</option>
          {TEMPLATES.map((t) => (
            <option key={t.label}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="staff-body" className="block text-sm font-medium">
          {mode === 'reply' ? 'Reply (they see this)' : 'Note (staff only)'}
        </label>
        <textarea
          id="staff-body"
          ref={body}
          name="body"
          rows={6}
          defaultValue={state.values?.body}
          className={`w-full border px-3 py-2 focus:border-black focus:outline-none ${
            mode === 'note' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 bg-surface'
          }`}
        />
        <p className="text-xs text-gray-500">Formatting: **bold**, - lists, [links](/help).</p>
      </div>
      {mode === 'reply' && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="resolve" className="size-4 accent-black" />
          Mark as resolved after sending
        </label>
      )}
      <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
        {pending ? 'Sending...' : mode === 'reply' ? 'Send reply' : 'Add note'}
      </button>
    </form>
  );
}

'use client';

import { Sparkles } from 'lucide-react';
import { useActionState, useRef, useState, useTransition } from 'react';
import { draftReplyWithAi } from '@/app/ai-actions';
import { AiLabel } from '@/components/ai-label';
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

export function StaffReplyForm({ ticketNumber, ai }: { ticketNumber: number; ai: boolean }) {
  const [state, action, pending] = useActionState(
    staffReply.bind(null, ticketNumber),
    initialFormState,
  );
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const body = useRef<HTMLTextAreaElement>(null);
  const [drafting, startDraft] = useTransition();
  const [draft, setDraft] = useState<{ note?: string; error?: string } | null>(null);

  function draftReply() {
    startDraft(async () => {
      const result = await draftReplyWithAi(ticketNumber);
      if ('error' in result) return setDraft({ error: result.error });
      setMode('reply');
      if (body.current) {
        body.current.value = result.data.reply;
        body.current.focus();
      }
      setDraft({ note: result.data.internalNote });
    });
  }

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
      {ai && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={draftReply}
            disabled={drafting}
            className="btn-outline px-3 py-1.5 text-sm disabled:opacity-60"
          >
            <Sparkles className="size-4 text-brand-ink" aria-hidden />
            {drafting ? 'Drafting...' : 'Draft a reply with AI'}
          </button>
          {draft?.error && <p className="text-sm text-red-700">{draft.error}</p>}
          {draft?.note && (
            <p className="border-l-4 border-yellow-500 bg-yellow-50 p-2 text-sm">
              <span className="font-semibold">For staff:</span> {draft.note}
            </p>
          )}
          {draft && !draft.error && (
            <AiLabel>AI draft below: read and edit it before sending.</AiLabel>
          )}
        </div>
      )}
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

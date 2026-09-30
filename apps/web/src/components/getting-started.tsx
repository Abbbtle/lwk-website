import { Check } from 'lucide-react';
import Link from 'next/link';
import { hideChecklist } from '@/app/onboarding-actions';
import type { Checklist } from '@/server/onboarding';
import { HelpLink } from './help-link';

/** A getting-started checklist worked out from what the person has done so far. */
export function GettingStarted({ checklist }: { checklist: Checklist }) {
  const done = checklist.items.filter((item) => item.done).length;
  const percent = Math.round((done / checklist.items.length) * 100);
  return (
    <section aria-labelledby={`${checklist.key}-title`} className="bg-white p-6 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${checklist.key}-title`} className="text-xl font-bold">
            {checklist.title}
          </h2>
          <p className="text-sm text-gray-600">
            {done} of {checklist.items.length} done
          </p>
        </div>
        <form action={hideChecklist.bind(null, checklist.key)}>
          <button
            type="submit"
            className="cursor-pointer text-sm text-gray-600 underline hover:text-black"
          >
            Hide this list
          </button>
        </form>
      </div>
      <div
        role="progressbar"
        aria-label={`${checklist.title} progress`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 h-2 w-full bg-gray-200"
      >
        <div className="h-2 bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-5 space-y-3">
        {checklist.items.map((item) => (
          <li key={item.label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                item.done ? 'border-green-700 bg-green-700 text-white' : 'border-gray-400'
              }`}
            >
              {item.done && <Check className="size-4" aria-hidden />}
            </span>
            <span className="sr-only">{item.done ? 'Done: ' : 'To do: '}</span>
            {item.done ? (
              <span className="text-gray-500 line-through">{item.label}</span>
            ) : (
              <Link href={item.href} className="font-semibold hover:text-brand-ink hover:underline">
                {item.label}
              </Link>
            )}
            {!item.done && item.help && (
              <HelpLink slug={item.help} className="text-xs">
                How
              </HelpLink>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

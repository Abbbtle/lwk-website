'use client';

import { LogOut } from 'lucide-react';
import { type MouseEvent, useId, useRef, useState } from 'react';

/**
 * Log Out with a confirmation dialog (native <dialog>: focus stays inside, Esc closes, the page
 * behind is inert). Cancel has initial focus so an accidental Enter never signs anyone out.
 * Without JavaScript the button submits the form directly, so logging out always works.
 */
export function LogoutButton({ className, name }: { className: string; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);

  function open(event: MouseEvent) {
    event.preventDefault();
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <form action="/auth/logout" method="post">
        <button type="submit" onClick={open} className={className}>
          Log Out
        </button>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-black/50"
      >
        <form
          action="/auth/logout"
          method="post"
          onSubmit={() => setPending(true)}
          className="bg-white p-6 text-left shadow-xl sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-brand">
              <LogOut className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id={titleId} className="text-xl font-bold text-gray-900">
                Log out of Living With Krishna?
              </h2>
              <p className="mt-2 text-gray-700">
                You are signed in as <span className="font-semibold">{name}</span>. Your progress is
                saved, so you can pick up where you left off when you log back in.
              </p>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              name="everywhere"
              value="1"
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              Also log me out on my other devices
              <span className="block text-xs text-gray-500">
                Use this on a shared or lost device.
              </span>
            </span>
          </label>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {/* Cancel is first in focus order and receives focus when the dialog opens. */}
            <button type="button" autoFocus onClick={close} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
              {pending ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

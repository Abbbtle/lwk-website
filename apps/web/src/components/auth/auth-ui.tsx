'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';

/** Centered white card on the page background, as the POC's sign-in card. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex justify-center px-4 py-16 md:py-24">
      <div className="w-full max-w-md bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-3 text-center text-gray-600">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && (
          <div className="mt-8 border-t border-gray-200 pt-6 text-center text-sm">{footer}</div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full border border-gray-300 bg-surface px-4 py-2.5 focus:border-black focus:outline-none';

export function AuthField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = props.type === 'password';
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={isPassword && visible ? 'text' : props.type}
          className={`${inputClass} ${isPassword ? 'pr-12' : ''}`}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-black"
          >
            {visible ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive">
      {message && (
        <p className="mb-5 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900">
          {message}
        </p>
      )}
    </div>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="mb-5 border-l-4 border-brand bg-orange-50 p-3 text-sm">
      {children}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="btn-solid w-full disabled:opacity-60">
      {pending ? 'Please wait...' : children}
    </button>
  );
}

export const PASSWORD_HINT =
  'At least 12 characters, with upper and lower case letters and a number.';

/** Same rules as the Cognito password policy (infra/lib/auth-stack.ts). */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Use both upper and lower case letters.';
  }
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return null;
}

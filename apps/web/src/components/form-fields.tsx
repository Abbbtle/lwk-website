import type { ReactNode } from 'react';
import type { FormState } from '@/lib/forms/form-state';

const inputClass =
  'w-full border border-gray-300 bg-white px-4 py-2.5 focus:border-black focus:outline-none aria-invalid:border-red-600';

type FieldProps = {
  name: string;
  label: string;
  state: FormState;
  required?: boolean;
  hint?: string;
};

function Field({
  name,
  label,
  state,
  required,
  hint,
  children,
}: FieldProps & { children: (props: FieldAria) => ReactNode }) {
  const error = state.errors?.[name]?.[0];
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ');
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block font-medium">
        {label}
        {!required && <span className="font-normal text-gray-500"> (optional)</span>}
      </label>
      {children({
        id: name,
        name,
        required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
        defaultValue: state.values?.[name],
      })}
      {/* Hint sits below the control so inputs in the same row stay aligned. */}
      {hint && (
        <p id={`${name}-hint`} className="text-sm text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type FieldAria = {
  id: string;
  name: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  defaultValue?: string;
};

export function TextField({
  type = 'text',
  autoComplete,
  ...props
}: FieldProps & { type?: string; autoComplete?: string }) {
  return (
    <Field {...props}>
      {(aria) => <input type={type} autoComplete={autoComplete} className={inputClass} {...aria} />}
    </Field>
  );
}

export function TextAreaField({ rows = 4, ...props }: FieldProps & { rows?: number }) {
  return (
    <Field {...props}>{(aria) => <textarea rows={rows} className={inputClass} {...aria} />}</Field>
  );
}

export function SelectField({
  options,
  placeholder = 'Select...',
  ...props
}: FieldProps & {
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <Field {...props}>
      {({ defaultValue, ...aria }) => (
        <select className={inputClass} defaultValue={defaultValue ?? ''} {...aria}>
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => {
            const { value, label } =
              typeof option === 'string' ? { value: option, label: option } : option;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

export function FormStatus({ state }: { state: FormState }) {
  if (state.status === 'idle') return <div aria-live="polite" />;
  const tone =
    state.status === 'received'
      ? 'border-green-700 bg-green-50 text-green-900'
      : 'border-red-600 bg-red-50 text-red-900';
  return (
    <div aria-live="polite" className={`border-l-4 p-4 ${tone}`}>
      {state.message}
    </div>
  );
}

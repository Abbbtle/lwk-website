'use client';

import { useActionState, type ReactNode } from 'react';
import { FormStatus, SelectField, TextAreaField, TextField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { degreeOptions } from '@/lib/forms/instructor-application';
import { submitApplication } from './actions';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function InstructorForm({
  countries,
  defaults,
}: {
  countries: string[];
  /** Pre-filled from the signed-in account. */
  defaults: { fullName: string; email: string };
}) {
  const [state, formAction, pending] = useActionState(submitApplication, {
    ...initialFormState,
    values: defaults,
  });

  // After a successful submit, show only the confirmation.
  if (state.status === 'received') return <FormStatus state={state} />;

  return (
    <form action={formAction} noValidate className="space-y-8">
      <FormStatus state={state} />

      <Section title="Personal Information">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            name="fullName"
            label="Full Name (as seen on Identity Documents)"
            autoComplete="name"
            required
            state={state}
          />
          <TextField name="initiatedName" label="Initiated Name" state={state} />
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            state={state}
          />
          <SelectField
            name="nationality"
            label="Nationality"
            options={countries}
            placeholder="Select your nationality"
            required
            state={state}
          />
          <TextField
            name="phoneNumber"
            label="Phone Number"
            type="tel"
            autoComplete="tel"
            hint="Include your country code, e.g. +27 82 123 4567"
            required
            state={state}
          />
          <TextField name="linkedIn" label="LinkedIn Profile" type="url" state={state} />
          <TextField name="website" label="Website/Portfolio" type="url" state={state} />
        </div>
      </Section>

      <Section title="Professional Background">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            name="expertise"
            label="Area of Expertise"
            hint="e.g. Kirtan, prasadam cooking, Bhagavad-gita"
            required
            state={state}
          />
          <TextField
            name="experienceYears"
            label="Years of Experience"
            type="number"
            required
            state={state}
          />
          <SelectField
            name="degree"
            label="Highest Degree Earned"
            options={degreeOptions}
            required
            state={state}
          />
          <TextField name="certifications" label="Relevant Certifications" state={state} />
          <TextAreaField name="workExperience" label="Work Experience" required state={state} />
          <TextAreaField
            name="teachingExperience"
            label="Teaching Experience"
            required
            state={state}
          />
          <TextField
            name="languages"
            label="Languages Spoken"
            hint="Separate languages with commas"
            required
            state={state}
          />
        </div>
      </Section>

      <Section title="Motivational Section">
        <TextAreaField
          name="motivation"
          label="Why do you want to become an instructor?"
          required
          state={state}
        />
        <TextAreaField
          name="philosophy"
          label="What is your teaching philosophy?"
          required
          state={state}
        />
        <TextAreaField
          name="strengths"
          label="Describe your unique strengths."
          required
          state={state}
        />
      </Section>

      <button type="submit" className="btn-outline" disabled={pending}>
        {pending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

'use client';

import { useActionState, type ReactNode } from 'react';
import { FormStatus, SelectField, TextAreaField, TextField } from '@/components/form-fields';
import { initialFormState } from '@/lib/forms/form-state';
import { degreeOptions } from '@/lib/forms/instructor-application';
import { submitInstructorApplication } from './actions';

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5 border border-gray-300 p-6">
      <legend className="px-2 text-xl font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function InstructorForm({ countries }: { countries: string[] }) {
  const [state, formAction, pending] = useActionState(
    submitInstructorApplication,
    initialFormState,
  );

  return (
    <form action={formAction} noValidate className="space-y-8">
      <FormStatus state={state} />

      <Fieldset legend="Personal Information">
        <TextField
          name="fullName"
          label="Full Name (as seen on Identity Documents)"
          autoComplete="name"
          required
          state={state}
        />
        <TextField name="initiatedName" label="Initiated Name" state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
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
        </div>
        <SelectField
          name="nationality"
          label="Nationality"
          options={countries}
          placeholder="Select your nationality"
          required
          state={state}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="linkedIn" label="LinkedIn Profile" type="url" state={state} />
          <TextField name="website" label="Website/Portfolio" type="url" state={state} />
        </div>
      </Fieldset>

      <Fieldset legend="Professional Background">
        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>
        <SelectField
          name="degree"
          label="Highest Degree Earned"
          options={degreeOptions}
          required
          state={state}
        />
        <TextAreaField name="certifications" label="Relevant Certifications" state={state} />
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
      </Fieldset>

      <Fieldset legend="Motivation">
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
      </Fieldset>

      <button type="submit" className="btn-brand" disabled={pending}>
        {pending ? 'Submitting...' : 'Submit application'}
      </button>
    </form>
  );
}

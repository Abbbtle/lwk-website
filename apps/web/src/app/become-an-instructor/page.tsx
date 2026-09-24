import type { Metadata } from 'next';
import { countries } from '@/lib/countries';
import { InstructorForm } from './instructor-form';

export const metadata: Metadata = {
  title: 'Become an Instructor',
  description: 'Share your knowledge of devotional life with learners around the world.',
};

export default function BecomeAnInstructorPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold md:text-5xl">
        Become An <span className="text-brand">Instructor</span>
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        We are looking for passionate and knowledgeable instructors from around the world. Fill out
        the form below to get started.
      </p>
      <div className="mt-10">
        <InstructorForm countries={countries} />
      </div>
    </div>
  );
}

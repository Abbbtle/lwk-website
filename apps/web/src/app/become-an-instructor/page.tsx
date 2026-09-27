import type { Metadata } from 'next';
import Link from 'next/link';
import { countries } from '@/lib/countries';
import { getSession, hasRole } from '@/server/auth/session';
import { getLatestApplication } from '@/server/instructor-applications';
import { InstructorForm } from './instructor-form';

export const metadata: Metadata = {
  title: 'Become an Instructor',
  description: 'Share your knowledge of devotional life with learners around the world.',
};

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 bg-surface p-8">{children}</div>;
}

export default async function BecomeAnInstructorPage() {
  const session = await getSession();
  const latest = session ? await getLatestApplication(session.userId) : null;

  let content: React.ReactNode;
  if (!session) {
    content = (
      <Notice>
        <p className="text-lg">Please sign in or create an account to apply.</p>
        <div className="flex flex-wrap gap-3">
          <a href="/auth/signup?returnTo=%2Fbecome-an-instructor" className="btn-solid">
            Create an account
          </a>
          <a href="/auth/login?returnTo=%2Fbecome-an-instructor" className="btn-outline">
            Log In
          </a>
        </div>
      </Notice>
    );
  } else if (hasRole(session, 'instructor') || latest?.status === 'APPROVED') {
    content = (
      <Notice>
        <p className="text-lg">You are an approved instructor.</p>
        <Link href="/instructor" className="btn-solid">
          Go to your instructor dashboard
        </Link>
      </Notice>
    );
  } else if (latest?.status === 'PENDING') {
    content = (
      <Notice>
        <p className="text-lg font-semibold">Your application is under review.</p>
        <p className="text-gray-700">
          Submitted on {latest.createdAt.toLocaleDateString('en-GB', { dateStyle: 'long' })}. We
          will be in touch by email.
        </p>
      </Notice>
    );
  } else {
    content = (
      <>
        {latest?.status === 'REJECTED' && (
          <div className="mb-8 border-l-4 border-brand bg-surface p-4">
            <p className="font-semibold">Your previous application was not approved.</p>
            {latest.reviewNote && <p className="mt-1 text-gray-700">{latest.reviewNote}</p>}
            <p className="mt-1 text-gray-700">You are welcome to apply again.</p>
          </div>
        )}
        <InstructorForm
          countries={countries}
          defaults={{ fullName: session.name, email: session.email }}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold md:text-5xl">
        Become An <span className="text-brand">Instructor</span>
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        We are looking for passionate and knowledgeable instructors from around the world. Fill out
        the form below to get started.
      </p>
      <div className="mt-10">{content}</div>
    </div>
  );
}

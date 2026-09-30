import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Logged out', robots: { index: false } };

export default async function LoggedOutPage({ searchParams }: PageProps<'/logged-out'>) {
  const { everywhere, deleted } = await searchParams;

  if (deleted === '1') {
    return (
      <div className="flex justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-md bg-white p-8 text-center shadow-lg">
          <CheckCircle2 className="mx-auto size-12 text-brand" aria-hidden />
          <h1 className="mt-4 text-3xl font-bold">Your account has been deleted</h1>
          <p className="mt-3 text-gray-700">
            We have removed your account and your learning history. Thank you for learning with us.
            You are always welcome back.
          </p>
          <Link href="/" className="btn-outline mt-8 w-full">
            Go to the home page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 py-16 md:py-24">
      <div className="w-full max-w-md bg-white p-8 text-center shadow-lg">
        <CheckCircle2 className="mx-auto size-12 text-brand" aria-hidden />
        <h1 className="mt-4 text-3xl font-bold">You&apos;ve logged out</h1>
        <p className="mt-3 text-gray-700">
          {everywhere === '1'
            ? 'You have been logged out on this device and all your other devices.'
            : 'You have been logged out on this device.'}{' '}
          Your learning progress is saved.
        </p>
        {everywhere === 'failed' && (
          <p className="mt-4 border-l-4 border-red-600 bg-red-50 p-3 text-left text-sm text-red-900">
            We could not log out your other devices. Log in again and try once more, or contact
            support if this keeps happening.
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className="btn-solid">
            Log in again
          </Link>
          <Link href="/" className="btn-outline">
            Continue browsing
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Sign-in problem', robots: { index: false } };

const messages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  expired: 'Your sign-in took too long or was already completed.',
  failed: 'We could not complete your sign-in.',
};

export default async function AuthErrorPage({ searchParams }: PageProps<'/auth/error'>) {
  const { reason } = await searchParams;
  const message = messages[typeof reason === 'string' ? reason : 'failed'] ?? messages.failed;

  return (
    <div className="flex items-center justify-center bg-gray-100 px-4 py-24">
      <div className="w-full max-w-md bg-white p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold">Sign-in problem</h1>
        <p className="mt-4 text-gray-700">{message} Please try again.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/auth/login" className="btn-solid">
            Try again
          </Link>
          <Link href="/" className="btn-outline">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

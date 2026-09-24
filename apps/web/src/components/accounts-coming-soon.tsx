import Link from 'next/link';

// Placeholder until sign-in with Amazon Cognito arrives in Phase 3.
export function AccountsComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center bg-gray-100 px-4 py-24">
      <div className="w-full max-w-md bg-white p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-4 text-gray-700">
          Student accounts are opening soon. In the meantime, you can browse every course.
        </p>
        <Link href="/explore" className="btn-solid mt-8 w-full">
          Explore courses
        </Link>
      </div>
    </div>
  );
}

import { Download, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import { deletionBlocker } from '@/server/account';
import { getCognitoClientConfig } from '@/server/auth/client-config';
import { requireSession } from '@/server/auth/session';
import { DeleteAccount } from './delete-account';

export const metadata: Metadata = { title: 'Privacy and data' };

export default async function PrivacyPage() {
  const session = await requireSession('/account/privacy');
  const blocker = await deletionBlocker(session);

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 shadow-md sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-brand">
            <Download className="size-5" aria-hidden />
          </span>
          Download your data
        </h2>
        <p className="mt-5 text-gray-700">
          Get a copy of everything we store about you: your profile, enrollments, progress,
          applications, messages you sent us and your account activity, as a JSON file.
        </p>
        <a href="/api/v1/me/export" download className="btn-outline mt-5">
          Download my data
        </a>
      </section>

      <section className="bg-white p-6 shadow-md sm:p-8">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
            <Trash2 className="size-5" aria-hidden />
          </span>
          Delete your account
        </h2>
        <p className="mt-5 text-gray-700">
          Permanently delete your account and your learning history. You will need to confirm with
          your password.
        </p>
        <div className="mt-5">
          <DeleteAccount
            config={getCognitoClientConfig()}
            email={session.email}
            blocker={blocker}
          />
        </div>
      </section>
    </div>
  );
}

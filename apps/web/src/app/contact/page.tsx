import type { Metadata } from 'next';
import Link from 'next/link';
import { BeadStrand, type BeadStrandItem } from '@/components/bead-strand';
import { inquiryTypes } from '@/lib/forms/contact';
import { site } from '@/lib/site';
import { getSession } from '@/server/auth/session';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions, feedback or partnership ideas? Get in touch with Living With Krishna.',
};

const itemHeading = 'text-lg font-semibold text-black';
const itemLink =
  'mt-1 inline-block font-semibold underline underline-offset-4 hover:text-brand-ink';

const otherWays: BeadStrandItem[] = [
  {
    id: 'email',
    content: (
      <>
        <h2 className={itemHeading}>Email</h2>
        <a href={`mailto:${site.supportEmail}`} className={`${itemLink} break-all`}>
          {site.supportEmail}
        </a>
      </>
    ),
  },
  {
    id: 'office-hours',
    content: (
      <>
        <h2 className={itemHeading}>Office hours</h2>
        {/* Lines break between the parts, never inside one ("(UTC + 2)" stays together). */}
        <p className="mt-1 text-gray-700">
          {site.officeHours.map((part) => part.replaceAll(' ', ' ')).join(' ')}
        </p>
      </>
    ),
  },
  {
    id: 'help',
    content: (
      <>
        <h2 className={itemHeading}>Help centre</h2>
        <p className="mt-1 text-gray-700">
          Answers to common questions about courses and accounts.
        </p>
        <Link href="/help" className={itemLink}>
          Visit the help centre
        </Link>
      </>
    ),
  },
];

export default async function ContactPage({ searchParams }: PageProps<'/contact'>) {
  const type = (await searchParams).type;
  const inquiryType = inquiryTypes.find((t) => t.value === type)?.value;
  const session = await getSession();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl">Contact us</h1>
      <p className="mt-3 max-w-2xl text-lg text-gray-700">
        Questions, feedback or partnership ideas? Send us a message, or reach us another way.
      </p>

      <div className="mt-12 grid gap-x-16 gap-y-14 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {session && (
            <p className="border-l-4 border-brand bg-orange-50 p-4 text-sm">
              You are logged in: for questions about your account or courses,{' '}
              <Link href="/support/new" className="font-semibold underline">
                send a support request
              </Link>{' '}
              and follow our reply in your account.
            </p>
          )}
          <ContactForm inquiryType={inquiryType} />
        </div>
        <div className="lg:col-span-5">
          <BeadStrand items={otherWays} label="Other ways to reach us" />
        </div>
      </div>
    </div>
  );
}

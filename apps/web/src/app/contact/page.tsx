import type { Metadata } from 'next';
import Link from 'next/link';
import { inquiryTypes } from '@/lib/forms/contact';
import { site, socialLinks } from '@/lib/site';
import { getSession } from '@/server/auth/session';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions, feedback or partnership ideas? Get in touch with Living With Krishna.',
};

export default async function ContactPage({ searchParams }: PageProps<'/contact'>) {
  const type = (await searchParams).type;
  const inquiryType = inquiryTypes.find((t) => t.value === type)?.value;
  const session = await getSession();
  return (
    <>
      <div className="overflow-hidden py-10" aria-hidden>
        <p className="animate-marquee text-7xl font-extrabold whitespace-nowrap text-brand uppercase md:text-9xl">
          {Array.from({ length: 8 }, () => 'Contact us ').join('')}
        </p>
      </div>
      <h1 className="sr-only">Contact us</h1>

      <div className="grid gap-12 px-6 pb-20 md:px-8 lg:grid-cols-2">
        <div className="space-y-12">
          <p className="text-xl md:text-2xl">
            We&apos;re excited to connect with you! Whether you have a question, need expert
            guidance, or want to share feedback, we&apos;re here to assist you every step of the
            way.
          </p>

          <section>
            <h2 className="text-xl font-bold uppercase">Social media</h2>
            <p className="mt-2 font-medium uppercase">
              {socialLinks
                .filter((s) => s.id !== 'facebook')
                .map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ' — '}
                    {s.href ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brand"
                      >
                        {s.id === 'x' ? 'Twitter' : s.label}
                      </a>
                    ) : (
                      <span title="Coming soon">{s.id === 'x' ? 'Twitter' : s.label}</span>
                    )}
                  </span>
                ))}
            </p>
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="text-xl font-bold uppercase">Get in touch</h2>
              <a
                href={`mailto:${site.supportEmail}`}
                className="mt-2 block uppercase hover:text-brand"
              >
                {site.supportEmail}
              </a>
            </section>
            <section>
              <h2 className="text-xl font-bold uppercase">Office hours</h2>
              <p className="mt-2 uppercase">
                {site.officeHours.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </section>
          </div>
        </div>

        <div className="space-y-6">
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
      </div>
    </>
  );
}

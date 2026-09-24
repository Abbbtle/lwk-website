import { Mail } from 'lucide-react';
import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Questions, feedback or partnership ideas? Get in touch with Living With Krishna.',
};

export default function ContactPage() {
  return (
    <>
      <div className="overflow-hidden bg-black py-4 text-white" aria-hidden>
        <p className="animate-marquee text-3xl font-extrabold whitespace-nowrap uppercase">
          {Array.from({ length: 12 }, () => 'contact us · ').join('')}
        </p>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="space-y-6 lg:col-span-2">
          <h1 className="text-3xl font-extrabold md:text-4xl">Get in touch</h1>
          <p className="text-gray-700">
            We&apos;re excited to connect with you! Whether you have a question, need expert
            guidance, or want to share feedback, we&apos;re here to assist you every step of the
            way.
          </p>
          <a
            href={`mailto:${site.supportEmail}`}
            className="flex items-center gap-3 font-semibold hover:text-brand"
          >
            <Mail className="size-5 text-brand" aria-hidden />
            {site.supportEmail}
          </a>
        </div>
        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
    </>
  );
}

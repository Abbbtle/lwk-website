import { Check, FileText, Newspaper, PlayCircle, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CourseSummary } from '@/lib/catalog/types';
import { plural } from '@/lib/format';
import { sectionHeading, sectionIntro, textLink } from './styles';

// What learning here is like, as large panels in the manner of Apple's home page: a headline, a
// sentence, a link and one simple picture of the real product (drawn in HTML, so nothing to
// download). The pictures are decorative; the text says everything.

/** A white card floating on the panel, for the pictures. */
const card = 'rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5';

function Tile({
  heading,
  text,
  link,
  children,
}: {
  heading: string;
  text: string;
  link: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-3xl bg-gray-100 px-6 pt-10 text-center sm:px-10 md:pt-12">
      <h3 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">{heading}</h3>
      <p className={`mx-auto mt-3 max-w-md ${sectionIntro}`}>{text}</p>
      <Link href={link.href} className={`mt-4 inline-block self-center ${textLink}`}>
        {link.label}
      </Link>
      <div aria-hidden className="mt-10 flex flex-1 items-end justify-center pb-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </li>
  );
}

function ProgressPicture({ course }: { course?: CourseSummary }) {
  const total = course?.lessonCount || 15;
  const done = Math.max(1, Math.round(total * 0.3));
  return (
    <div className={card}>
      <p className="text-xs text-gray-500">Continue learning</p>
      <p className="mt-1 truncate font-semibold text-gray-900">{course?.title ?? 'Your course'}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-600">
          {done} of {plural(total, 'lesson')} complete
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-gray-900">
          <PlayCircle className="size-4" />
          Resume
        </span>
      </div>
    </div>
  );
}

function TrustPicture() {
  return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-brand-ink">
          <ShieldCheck className="size-5" />
        </span>
        <p className="font-semibold text-gray-900">Approved instructor</p>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        {['Application reviewed', 'Course reviewed before publishing'].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check className="size-4 text-brand-ink" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const formats = [
  { label: 'Video', icon: PlayCircle },
  { label: 'Text', icon: Newspaper },
  { label: 'PDF', icon: FileText },
];

function FormatsPicture() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {formats.map(({ label, icon: Icon }) => (
        <div key={label} className={`${card} flex flex-col items-center gap-2 px-2`}>
          <Icon className="size-7 text-gray-900" />
          <span className="text-sm font-semibold text-gray-900">{label}</span>
        </div>
      ))}
    </div>
  );
}

function HelpPicture() {
  return (
    <div className="space-y-3">
      <div className={`${card} flex items-center gap-3 rounded-full py-3`}>
        <Search className="size-4 shrink-0 text-gray-500" />
        <span className="truncate text-sm text-gray-700">How do I reset my password?</span>
      </div>
      <div className={card}>
        <p className="font-semibold text-gray-900">Forgot your password?</p>
        <p className="mt-1 text-sm text-gray-600">
          Reset it with a code sent to your email address.
        </p>
      </div>
    </div>
  );
}

export function FeatureTiles({ course }: { course?: CourseSummary }) {
  return (
    <section
      aria-labelledby="features"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="features" className={sectionHeading}>
          Everything you need to learn at home
        </h2>
        <p className={`mt-4 ${sectionIntro}`}>
          Simple to use on a phone, tablet or computer, wherever you are.
        </p>
      </div>
      <ul className="mt-12 grid gap-6 md:grid-cols-2">
        <Tile
          heading="Learn at your own pace"
          text="Videos pick up where you stopped, and My Learning shows how far you have come."
          link={{ href: '/help/using-the-lesson-player', label: 'How lessons work' }}
        >
          <ProgressPicture course={course} />
        </Tile>
        <Tile
          heading="Teachers you can trust"
          text="Every instructor is approved, and every course is reviewed before it is published."
          link={{ href: '/become-an-instructor', label: 'How teaching works' }}
        >
          <TrustPicture />
        </Tile>
        <Tile
          heading="Watch, read or print"
          text="Lessons come as video, text and PDF, so you can learn in the way that suits you."
          link={{ href: '/courses', label: 'Browse courses' }}
        >
          <FormatsPicture />
        </Tile>
        <Tile
          heading="Help whenever you need it"
          text="Search the help centre, or send us a request and follow our reply in your account."
          link={{ href: '/help', label: 'Visit the help centre' }}
        >
          <HelpPicture />
        </Tile>
      </ul>
    </section>
  );
}

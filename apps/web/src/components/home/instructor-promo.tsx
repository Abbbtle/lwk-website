import Image from 'next/image';
import Link from 'next/link';
import { sectionHeading, sectionIntro } from './styles';

const steps = [
  { title: 'Apply', text: 'Tell us about your experience and what you would like to teach.' },
  { title: 'Get approved', text: 'An admin reviews your application and lets you know.' },
  {
    title: 'Build and submit',
    text: 'Create your course with video, PDF and text lessons, then send it for review.',
  },
];

/** Becoming an instructor, with a photo and the steps to get there (as on Udemy). */
export function InstructorPromo() {
  return (
    <section
      aria-labelledby="instructor-promo"
      className="page-width grid items-center gap-10 py-16 lg:grid-cols-[28rem_minmax(0,1fr)] lg:gap-16 lg:py-24"
    >
      {/* TODO: a POC photo; it needs usage permission (or replacing) before the public launch. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gray-200 lg:aspect-square">
        <Image
          src="/images/become-instructor.jpg"
          alt="A devotee singing kirtan"
          fill
          sizes="(min-width: 1024px) 448px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="max-w-xl">
        <h2 id="instructor-promo" className={sectionHeading}>
          Become an instructor
        </h2>
        <p className={`mt-4 ${sectionIntro}`}>
          Share the devotional skills you love with learners everywhere. We give you the tools to
          build a course and review it with you before it is published.
        </p>
        <ol className="mt-8 space-y-5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="text-gray-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/become-an-instructor" className="btn-solid mt-8">
          Start teaching today
        </Link>
      </div>
    </section>
  );
}

import { Check, ChevronDown, User, Users, UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description: 'Subscription plans for individuals, groups and classrooms.',
};

// Prices are decided in the payments phase (see docs/PLAN.md), so none are shown yet.
const plans = [
  {
    name: 'Solo Learning',
    icon: User,
    audience: 'For individual learners',
    features: [
      'Access to every course',
      'Learn at your own pace',
      'Track your progress',
      'Certificates of completion',
    ],
  },
  {
    name: 'Group Learning',
    icon: Users,
    audience: 'For families and small study groups',
    features: [
      'Everything in Solo Learning',
      'Multiple learners on one plan',
      'Shared group progress',
      'Group discussion space',
    ],
  },
  {
    name: 'Classroom',
    icon: UsersRound,
    audience: 'For temples, schools and study circles',
    features: [
      'Everything in Group Learning',
      'Seats for a whole class',
      'Teacher dashboard',
      'Priority support',
    ],
  },
];

const faqs = [
  {
    question: 'How do I subscribe to a plan?',
    answer:
      'Subscriptions are opening soon. Once they are available, choose the plan that fits your needs on this page and follow the checkout steps.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes. You will be able to cancel at any time from your account settings.',
  },
  {
    question: 'What is Living With Krishna about?',
    answer:
      'Living With Krishna is a platform dedicated to sharing the timeless wisdom of the Bhagavad-gita and the teachings of Krishna. Our mission is to make these teachings accessible to everyone, promoting a life of spirituality, mindfulness, and inner peace.',
  },
  {
    question: 'How can I get involved?',
    answer:
      'Take a course, join community events, or share your own knowledge by applying to become an instructor.',
  },
  {
    question: 'What type of content do you provide?',
    answer:
      'Video lessons, readings and practical exercises covering kirtan, prasadam cooking, Vaisnava etiquette and the study of sacred texts.',
  },
];

export default function PlansAndPricingPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold md:text-5xl">
          Elevate Your Spiritual Practice with Tailored Plans
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-base md:text-lg">
          Select the path that aligns with your spiritual journey and unlock deeper insights, tools,
          and guidance.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-semibold text-gray-600">
          Monthly and annual billing · Pricing will be announced when subscriptions open
        </p>
        <ul className="flex flex-col gap-8 md:flex-row md:gap-14">
          {plans.map(({ name, icon: Icon, audience, features }) => (
            <li
              key={name}
              className="flex flex-1 flex-col border border-gray-600 bg-gray-100 p-6 hover:shadow-xl"
            >
              <Icon className="size-8 text-brand" aria-hidden />
              <h2 className="mt-4 text-xl font-semibold md:text-2xl">{name}</h2>
              <p className="mt-1 text-sm text-gray-600">{audience}</p>
              <p className="mt-4 text-lg font-medium">Coming soon</p>
              <ul className="mt-6 flex-grow space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/explore" className="btn-outline mt-8">
                Browse courses
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Frequently Asked Questions</h2>
          <div className="mt-8 divide-y divide-gray-300 border-y border-gray-300">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {question}
                  <ChevronDown
                    className="size-5 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 text-gray-700">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

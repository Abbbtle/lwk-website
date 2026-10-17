import type { Metadata } from 'next';
import { Faq } from '@/components/faq';

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description: 'Subscription plans for individuals, groups and classrooms.',
};

// Layout from the POC. Prices are decided in the payments phase (see docs/PLAN.md).
type Plan = {
  name: string;
  audience: string;
  features: string[];
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Solo Learning',
    audience: 'Personal use',
    features: [
      'Access to every course',
      'Learn at your own pace',
      'Track your progress',
      'Certificates of completion',
    ],
  },
  {
    name: 'Group Learning',
    audience: 'Best for 1-3 users',
    featured: true,
    features: [
      'Everything in Solo Learning',
      'Multiple learners on one plan',
      'Shared group progress',
      'Group discussion space',
    ],
  },
  {
    name: 'Classroom',
    audience: 'Best for 4-6 users',
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

function PlanCard({ plan, billing }: { plan: Plan; billing: string }) {
  const featured = plan.featured;
  return (
    <li
      className={`flex flex-col border p-6 ${
        featured ? 'border-brand bg-brand text-black' : 'border-gray-600 bg-gray-100'
      }`}
    >
      <h3 className="text-2xl font-semibold">{plan.name}</h3>
      <p className="mt-4 text-lg">Price coming soon</p>
      <p className={`mt-4 text-sm ${featured ? '' : 'text-gray-700'}`}>{plan.audience}</p>
      <p className={`mt-1 text-sm ${featured ? '' : 'text-gray-700'}`}>{billing}</p>
      <ul className="mt-8 flex-grow space-y-2">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <div className="mt-8 text-center">
        <a
          href="/sign-up?returnTo=%2Fexplore"
          className={
            featured ? 'btn border-white bg-white text-black hover:bg-gray-100' : 'btn-solid'
          }
        >
          Get started
        </a>
      </div>
    </li>
  );
}

function PlanGroup({ title, billing }: { title: string; billing: string }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12">
      <h2 className="text-center text-3xl font-semibold">{title}</h2>
      <p className="mt-2 mb-8 text-center">
        Access any of our courses with our {billing.toLowerCase().replace(' billing', '')}{' '}
        subscription plans
      </p>
      <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} billing={billing} />
        ))}
      </ul>
    </section>
  );
}

export default function PlansAndPricingPage() {
  return (
    <>
      <section className="px-6 pt-12 text-center">
        <h1 className="text-3xl font-bold md:text-5xl">
          Elevate Your Spiritual Practice with Tailored Plans
        </h1>
        <p className="mx-auto mt-4 max-w-3xl md:text-lg">
          Select the path that aligns with your spiritual journey and unlock deeper insights, tools,
          and guidance.
        </p>
        <p className="mt-4 text-sm font-semibold text-gray-600">
          Subscriptions open soon. Every course is free during early access.
        </p>
      </section>
      <PlanGroup title="Monthly Deals" billing="Monthly billing" />
      <PlanGroup title="Annual Deals" billing="Annual billing" />
      <Faq items={faqs} />
    </>
  );
}

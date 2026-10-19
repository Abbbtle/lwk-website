import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq } from '@/components/faq';
import {
  billingPeriodPhrase,
  COMMUNITY_MIN_SEATS,
  communitySeatPrice,
  courseStartingPrice,
  FAMILY_MAX_PEOPLE,
  familyPrice,
  formatMoney,
  formatRecurring,
  FOUNDING_MEMBER_PLACES,
  foundingMemberPrice,
  freePrice,
  MEMBERSHIP_TRIAL_DAYS,
  membershipLeadPrice,
  membershipPrices,
  monthlyEquivalent,
  PAID_PLANS_NOTICE_DAYS,
  perSeatPhrase,
  type PriceRegion,
  type RecurringPrice,
  regionTaxNote,
  visitorRegionPhrase,
  YEARLY_FULL_REFUND_DAYS,
  yearlySavingPercent,
} from '@/lib/pricing';
import { viewerPriceRegion } from '@/server/price-region';

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description:
    'Membership, Family and Community plans and single courses, priced for your country. Every course is free during early access.',
};

// The visitor's plans and prices, from the price list in src/lib/pricing. Paid plans open in the
// payments phase (see docs/PLAN.md); until then their buttons sign people up to learn for free.

type Plan = {
  name: string;
  audience: string;
  /** The amount, shown large: "R99". */
  price: string;
  /** What the amount is for: "a month". */
  per?: string;
  /** Another way to pay, or how the price is billed. */
  billing?: string;
  features: string[];
  action: { href: string; label: string };
  featured?: boolean;
};

const joinFree = { href: '/sign-up?returnTo=%2Fcourses', label: 'Join free during early access' };

/** A recurring price as a card shows it: the amount, then what it is for. */
function shownPrice(price: RecurringPrice, per = billingPeriodPhrase(price.period)) {
  return { price: formatMoney(price.amount), per };
}

/** The lead price, then the yearly option and its saving, or what yearly billing is a month. */
function membershipPricing(region: PriceRegion): Pick<Plan, 'price' | 'per' | 'billing'> {
  const lead = membershipLeadPrice(region);
  const { yearly } = membershipPrices(region);
  return {
    ...shownPrice(lead),
    billing:
      lead.period === 'month'
        ? `or ${formatRecurring(yearly)} (save ${yearlySavingPercent({ monthly: lead, yearly })}%)`
        : `${formatRecurring(monthlyEquivalent(yearly))}, billed yearly`,
  };
}

function plansFor(region: PriceRegion): Plan[] {
  const seat = communitySeatPrice(region);
  return [
    {
      name: 'Free',
      audience: 'For everyone',
      price: formatMoney(freePrice(region)),
      features: [
        'Explore: free talks, kirtan recordings and articles',
        'Every course marked Free',
        'Free preview lessons',
      ],
      action: { href: '/sign-up?returnTo=%2Fexplore', label: 'Create free account' },
    },
    {
      name: 'Membership',
      audience: 'For one person',
      ...membershipPricing(region),
      features: [
        'Every paid course',
        `Try it free for ${MEMBERSHIP_TRIAL_DAYS} days`,
        'Cancel any time',
        'More study help each day',
      ],
      action: joinFree,
      featured: true,
    },
    {
      name: 'Family',
      audience: 'For a household',
      ...shownPrice(familyPrice(region)),
      features: ['Everything in Membership', `Up to ${FAMILY_MAX_PEOPLE} people in one household`],
      action: joinFree,
    },
    {
      name: 'Community',
      audience: 'For temples, schools and study groups',
      ...shownPrice(seat, perSeatPhrase(seat.period)),
      features: [
        'Everything in Membership for each seat',
        `From ${COMMUNITY_MIN_SEATS} seats`,
        'A view for group leaders, coming later',
      ],
      action: joinFree,
    },
  ];
}

function faqsFor(region: PriceRegion) {
  const seat = communitySeatPrice(region);
  return [
    {
      question: 'When can I subscribe?',
      answer: `Paid plans open soon, and we will announce the start date ${PAID_PLANS_NOTICE_DAYS} days ahead. Until then every course is free during early access.`,
    },
    {
      question: 'Do I keep the courses I join during early access?',
      answer:
        'Yes. The courses you join during early access stay yours for good, also when paid plans open. Courses marked Free stay free for everyone.',
    },
    {
      question: 'Why are prices different in my country?',
      answer: `Prices follow local incomes, as on Udemy, so people everywhere can afford them. The prices on this page are for ${visitorRegionPhrase(region)}.`,
    },
    {
      question: 'Can I cancel?',
      answer: `Yes, at any time. A monthly membership runs to the end of the month you have paid for. A yearly membership is refunded in full within ${YEARLY_FULL_REFUND_DAYS} days, and in part after that.`,
    },
    {
      question: 'Is there a plan for a temple or group?',
      answer: `Yes. Community plans are for temples, schools and study groups, from ${COMMUNITY_MIN_SEATS} seats, at ${formatMoney(seat.amount)} ${perSeatPhrase(seat.period)}.`,
    },
    {
      question: 'Can I give a membership or sponsor someone?',
      answer: 'Gifts and sponsored places open together with paid plans.',
    },
    {
      question: 'What type of content do you provide?',
      answer:
        'Video lessons, readings and practical exercises covering kirtan, prasadam cooking, Vaisnava etiquette and the study of sacred texts.',
    },
  ];
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured;
  const muted = featured ? '' : 'text-gray-700';
  return (
    <li
      className={`flex flex-col rounded-card border p-6 ${
        featured ? 'border-brand bg-brand text-black' : 'border-gray-600 bg-gray-100'
      }`}
    >
      <h3 className="text-2xl font-semibold">{plan.name}</h3>
      <p className={`mt-1 text-sm ${muted}`}>{plan.audience}</p>
      <p className="mt-6">
        <span className="text-4xl font-extrabold">{plan.price}</span>
        {plan.per && ` ${plan.per}`}
      </p>
      {plan.billing && <p className={`mt-1 text-sm ${muted}`}>{plan.billing}</p>}
      <ul className="mt-6 flex-grow space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      <a
        href={plan.action.href}
        className={`mt-8 w-full text-center ${
          featured ? 'btn border-white bg-white text-black hover:bg-gray-100' : 'btn-solid'
        }`}
      >
        {plan.action.label}
      </a>
    </li>
  );
}

export default async function PlansAndPricingPage() {
  const region = await viewerPriceRegion();
  const { yearly } = membershipPrices(region);
  return (
    <>
      <section className="page-width pt-12 text-center">
        <h1 className="text-3xl font-bold md:text-5xl">
          Elevate Your Spiritual Practice with Tailored Plans
        </h1>
        <p className="mx-auto mt-4 max-w-3xl md:text-lg">
          One Membership opens every paid course. Families, temples and study groups can learn
          together, and single courses are yours to keep.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Prices for {visitorRegionPhrase(region)}, {regionTaxNote(region)}.
        </p>
        <p className="mx-auto mt-6 max-w-3xl rounded-card bg-brand px-4 py-3 text-sm font-semibold text-black sm:text-base">
          Paid plans open soon. Until then every course is free during early access, and the courses
          you join now stay yours.
        </p>
      </section>

      <section aria-labelledby="plans" className="page-width pt-12">
        <h2 id="plans" className="sr-only">
          Plans
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {plansFor(region).map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </ul>
        <div className="mt-10 space-y-3 text-center text-gray-700">
          <p>
            <strong className="text-gray-900">Founding members:</strong> join during early access,
            or be one of the first {FOUNDING_MEMBER_PLACES.toLocaleString('en-US')} members, and
            Membership is {formatRecurring(foundingMemberPrice(region))} instead of{' '}
            {formatRecurring(yearly)}.
          </p>
          <p>
            Prefer to buy{' '}
            <Link href="/courses" className="font-semibold text-gray-900 underline">
              single courses
            </Link>
            ? They start at {formatMoney(courseStartingPrice(region))} and are yours to keep.
          </p>
        </div>
      </section>

      <Faq items={faqsFor(region)} />
    </>
  );
}

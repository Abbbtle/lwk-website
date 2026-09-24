import { HandHeart, Sparkles, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Our Mission',
  description:
    "Bringing the wisdom of the Bhagavad-gita to modern life through Krishna's teachings.",
};

const offerings = [
  {
    icon: Sparkles,
    title: 'Spiritual Guidance',
    text: 'Providing insights and teachings from the Bhagavad-gita for a more peaceful and fulfilling life.',
  },
  {
    icon: HandHeart,
    title: 'Meditation & Mindfulness',
    text: 'Learn meditation techniques to connect with your inner self and embrace mindful living.',
  },
  {
    icon: Users,
    title: 'Community & Events',
    text: 'Join our community events, discussions, and workshops to connect with like-minded individuals.',
  },
];

export default function OurMissionPage() {
  return (
    <>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold uppercase md:text-5xl">
            Embracing Krishna&apos;s Teachings in <span className="text-brand">Modern Life</span>
          </h1>
          <p className="mt-4 text-lg text-gray-300">
            Providing quality Vaisnava education since 2024
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">About Living With Krishna</h2>
        <p className="mt-4 text-lg text-gray-700">
          Living With Krishna is dedicated to bringing the ancient wisdom of the Bhagavad-gita to
          the modern world. Our focus is on promoting spiritual growth, inner peace, and mindful
          living through Krishna&apos;s teachings. Whether you&apos;re a beginner or a seasoned
          practitioner, there&apos;s something here for everyone.
        </p>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold md:text-3xl">What We Offer</h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {offerings.map(({ icon: Icon, title, text }) => (
              <li key={title} className="bg-white p-8 text-center shadow-md">
                <Icon className="mx-auto size-10 text-brand" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-gray-700">{text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 text-center">
            <Link href="/explore" className="btn-solid">
              Explore courses
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

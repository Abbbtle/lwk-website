import type { Metadata } from 'next';
import Image from 'next/image';
import { Faq } from '@/components/faq';

export const metadata: Metadata = {
  title: 'Our Mission',
  description:
    "Bringing the wisdom of the Bhagavad-gita to modern life through Krishna's teachings.",
};

const offerings = [
  {
    title: 'Spiritual Guidance',
    text: 'Providing insights and teachings from the Bhagavad-gita for a more peaceful and fulfilling life.',
  },
  {
    title: 'Meditation & Mindfulness',
    text: 'Learn meditation techniques to connect with your inner self and embrace mindful living.',
  },
  {
    title: 'Community & Events',
    text: 'Join our community events, discussions, and workshops to connect with like-minded individuals.',
  },
];

const faqs = [
  {
    question: 'What is Living With Krishna about?',
    answer:
      'Living With Krishna is a platform dedicated to sharing the timeless wisdom of the Bhagavad-gita and the teachings of Krishna. Our mission is to make these teachings accessible to everyone, promoting a life of spirituality, mindfulness, and inner peace.',
  },
  {
    question: 'How can I get involved?',
    answer:
      'There are many ways to get involved, from participating in our online courses and events to volunteering and supporting our mission. You can also share your own knowledge by applying to become an instructor.',
  },
  {
    question: 'What type of content do you provide?',
    answer:
      'Video lessons, readings and practical exercises covering kirtan, prasadam cooking, Vaisnava etiquette and the study of sacred texts, with practical guidance for leading a balanced and fulfilling life.',
  },
];

export default function OurMissionPage() {
  return (
    <>
      <section className="relative flex min-h-[340px] items-start justify-center overflow-hidden md:min-h-[560px]">
        <Image
          src="/images/mission-hero.jpg"
          alt="The Temple of the Vedic Planetarium at sunset"
          fill
          preload
          sizes="100vw"
          className="object-cover"
        />
        <h1 className="relative mt-10 max-w-5xl px-6 text-center text-4xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] md:mt-16 md:text-6xl">
          Embracing Krishna&apos;s Teachings in Modern Life
        </h1>
      </section>
      <p className="bg-black py-4 text-center text-sm font-semibold tracking-wide text-white uppercase md:text-base">
        Providing quality Vaisnava education since 2024
      </p>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 py-20 md:flex-row">
        <div className="md:w-1/2">
          <h2 className="text-3xl font-bold md:text-4xl">About Living With Krishna</h2>
          <p className="mt-4 text-lg text-gray-700">
            Living With Krishna is dedicated to bringing the ancient wisdom of the Bhagavad-gita to
            the modern world. Our focus is on promoting spiritual growth, inner peace, and mindful
            living through Krishna&apos;s teachings. Whether you&apos;re a beginner or a seasoned
            practitioner, there&apos;s something here for everyone.
          </p>
        </div>
        <div className="md:w-1/2">
          <Image
            src="/images/mission-about.webp"
            alt="The Temple of the Vedic Planetarium seen across the river"
            width={1080}
            height={1586}
            sizes="(min-width: 768px) 30vw, 80vw"
            className="mx-auto h-auto w-2/3 rounded-md shadow-lg md:w-3/5"
          />
        </div>
      </section>

      <section className="px-6 pb-8">
        <h2 className="text-center text-3xl font-semibold">What We Offer</h2>
        <ul className="mx-auto mt-10 grid max-w-6xl gap-8 md:grid-cols-3">
          {offerings.map(({ title, text }) => (
            <li key={title} className="rounded-md bg-gray-100 p-6 shadow-md">
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-gray-600">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Faq items={faqs} />
    </>
  );
}

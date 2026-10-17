import Image from 'next/image';
import Link from 'next/link';

/** The mission, as a large black panel with the brand's Krishna drawing (as on Apple). */
export function MissionTile() {
  return (
    <section aria-labelledby="mission" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-black px-6 py-16 text-center text-white sm:px-12 lg:py-24">
        <Image
          src="/images/krishna-flute.svg"
          alt=""
          width={160}
          height={160}
          className="mx-auto h-auto w-28 md:w-36"
        />
        <h2
          id="mission"
          className="mx-auto mt-8 max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl"
        >
          Ancient wisdom for modern life
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-300">
          Living With Krishna brings the timeless teachings of the Bhagavad-gita into everyday life,
          for spiritual growth, inner peace and mindful living.
        </p>
        <Link
          href="/our-mission"
          className="mt-8 inline-block font-semibold text-brand underline underline-offset-4 hover:text-white"
        >
          Read our mission
        </Link>
      </div>
    </section>
  );
}

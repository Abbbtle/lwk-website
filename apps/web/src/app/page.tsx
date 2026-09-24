import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-3xl space-y-4 text-center md:text-left">
        <p className="text-lg font-extrabold uppercase md:text-xl lg:text-2xl">
          Rediscover Devotion
        </p>
        <h1 className="text-3xl font-extrabold uppercase md:text-4xl lg:text-6xl">
          Experience Bhakti Yoga like <span className="text-brand">never before.</span>
        </h1>
        <p className="text-sm text-gray-700 md:text-base lg:text-lg">
          Discover a transformative journey into the heart of Bhakti Yoga. Whether you are a
          beginner or looking to deepen your practice, our courses are designed to guide you
          step-by-step. Learn from experienced practitioners, connect with like-minded souls, and
          grow in devotion.
        </p>
        <div className="flex justify-center md:justify-start">
          <Link href="/explore" className="btn-outline">
            Start Learning
          </Link>
        </div>
      </div>
    </section>
  );
}

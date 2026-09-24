import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="bg-brand-soft">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Learn Krishna consciousness, at your own pace
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Courses on philosophy, kirtan, deity worship and daily sadhana, taught by devotees.
        </p>
        <Link
          href="/courses"
          className="mt-8 inline-block rounded-md bg-brand-strong px-6 py-3 font-medium text-background hover:opacity-90"
        >
          Browse courses
        </Link>
      </div>
    </section>
  );
}

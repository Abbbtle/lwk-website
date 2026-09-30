'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export type HeroSlide = {
  kicker: string;
  image: string;
  alt: string;
  href: string;
};

const AUTOPLAY_MS = 10_000;

/** POC home carousel: text and photo side by side, alternating, with arrows and dots. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduceMotion) return;
    const timer = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, go]);

  const arrow =
    'absolute top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer rounded-lg bg-black px-2 py-5 text-xl font-bold text-white md:block';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative px-6 py-10 md:px-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.kicker}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className={`flex w-full shrink-0 flex-col items-center gap-8 md:gap-10 ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              <div className="space-y-4 text-center md:w-1/2 md:text-left">
                <p className="text-lg font-extrabold uppercase md:text-xl lg:text-2xl">
                  {slide.kicker}
                </p>
                {i === 0 ? (
                  <h1 className="text-3xl font-extrabold uppercase md:text-4xl lg:text-6xl">
                    Experience Bhakti Yoga like never before.
                  </h1>
                ) : (
                  <p className="text-3xl font-extrabold uppercase md:text-4xl lg:text-6xl">
                    Experience Bhakti Yoga like never before.
                  </p>
                )}
                <p className="text-sm md:text-base lg:text-lg">
                  Discover a transformative journey into the heart of Bhakti Yoga. Whether you are a
                  beginner or looking to deepen your practice, our courses are designed to guide you
                  step-by-step. Learn from experienced practitioners, connect with like-minded
                  souls, and grow in devotion.
                </p>
                <div className="flex justify-center md:justify-start">
                  <Link href={slide.href} className="btn-outline">
                    Start Learning
                  </Link>
                </div>
              </div>
              <div className="relative aspect-[3/2] w-full shadow-md md:w-1/2">
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  preload={i === 0}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(index - 1)}
        className={`${arrow} left-2`}
      >
        ❮
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(index + 1)}
        className={`${arrow} right-2`}
      >
        ❯
      </button>

      <div className="mt-8 flex justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.kicker}
            type="button"
            aria-label={`Show slide ${i + 1}: ${slide.kicker}`}
            aria-current={i === index}
            onClick={() => go(i)}
            className={`size-2.5 cursor-pointer rounded-full ${i === index ? 'bg-brand' : 'bg-gray-300'}`}
          />
        ))}
      </div>
    </section>
  );
}

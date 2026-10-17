'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export type HeroBannerSlide = {
  id: string;
  heading: string;
  text: string;
  action: { href: string; label: string };
  /** Which side of the photo the card covers on wider screens: the side without the subject. */
  cardSide?: 'left' | 'right';
  image: {
    src: string;
    alt: string;
    /** CSS object-position, to keep the subject in view beside the card, e.g. "70% 30%". */
    position?: string;
  };
};

const arrow =
  'absolute top-[28.125vw] z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black text-white shadow-lg hover:bg-gray-800 md:top-[170px] md:size-12 lg:top-[200px]';

/**
 * A photo banner in the manner of Udemy's: a white card with the message over the photo (under it
 * on phones) and arrows to move between slides. It never moves by itself. Only the first photo
 * loads with the page; the others load once the visitor reaches for the arrows, so slow
 * connections are not kept busy with photos nobody asked for.
 */
export function HeroCarousel({ label, slides }: { label: string; slides: HeroBannerSlide[] }) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState<ReadonlySet<number>>(() => new Set([0]));
  const count = slides.length;

  /** Lets a slide's photo and its neighbours' photos load. */
  function warm(around: number) {
    setReady((previous) => {
      const next = new Set(previous);
      for (const i of [around - 1, around, around + 1]) next.add((i + count) % count);
      return next.size === previous.size ? previous : next;
    });
  }

  function go(next: number) {
    const target = (next + count) % count;
    warm(target);
    setIndex(target);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative -mx-4 sm:-mx-6 md:mx-0"
      onPointerEnter={() => warm(index)}
      onFocus={() => warm(index)}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => {
            const Heading = i === 0 ? 'h1' : 'h2';
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                inert={i !== index}
                className="relative w-full shrink-0"
              >
                <div className="relative aspect-video bg-gray-200 md:aspect-auto md:h-[340px] lg:h-[400px]">
                  {ready.has(i) && (
                    <Image
                      src={slide.image.src}
                      alt={slide.image.alt}
                      fill
                      sizes="(min-width: 1280px) 1248px, 100vw"
                      // The first photo is usually the largest thing on screen: fetch it first.
                      loading={i === 0 ? 'eager' : 'lazy'}
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      className="object-cover"
                      style={{ objectPosition: slide.image.position }}
                    />
                  )}
                </div>
                <div
                  className={`bg-white px-4 py-6 sm:px-6 md:absolute md:top-1/2 md:w-104 md:-translate-y-1/2 md:p-8 md:shadow-xl ${
                    slide.cardSide === 'right' ? 'md:right-20' : 'md:left-20'
                  }`}
                >
                  <Heading className="text-3xl leading-tight font-bold tracking-tight text-black lg:text-4xl">
                    {slide.heading}
                  </Heading>
                  <p className="mt-3 text-lg leading-relaxed text-gray-700">{slide.text}</p>
                  <Link href={slide.action.href} className="btn-solid mt-6">
                    {slide.action.label}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className={`${arrow} left-3 md:left-4`}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className={`${arrow} right-3 md:right-4`}
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </>
      )}
    </section>
  );
}

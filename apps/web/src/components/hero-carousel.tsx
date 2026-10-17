'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/** How long a slide shows before the next one. */
const SLIDE_MS = 7000;

type HeroAction = { href: string; label: string };

export type HeroBannerSlide = {
  id: string;
  /** A short label above the headline, e.g. "Free during early access". */
  tag?: string;
  heading: string;
  text: string;
  action: HeroAction;
  secondary?: HeroAction;
  /** Which side the text sits on (wider screens): the side away from the photo's subject. */
  align?: 'left' | 'right';
  /** A photo, with white text over a dark fade; without one the slide is a saffron brand panel. */
  image?: {
    src: string;
    alt: string;
    /** CSS object-position, to keep the subject in view, e.g. "50% 35%". */
    position?: string;
  };
};

/**
 * On wider screens, darkens the text side of a photo so white text reads on any picture; on
 * phones, where the text sits under the photo, fades the photo into the black below it.
 */
function scrimClass(align: HeroBannerSlide['align']) {
  const wide = align === 'right' ? 'md:bg-linear-to-l' : 'md:bg-linear-to-r';
  return `absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent md:from-black/80 md:via-black/40 ${wide}`;
}

/**
 * The home page banner: full-width slides, each a photo with white text over a dark fade, or a
 * saffron brand panel, with a label, a headline and two buttons. Slides move on by themselves;
 * rotation pauses while the pointer or keyboard focus is in the banner, stops with the pause
 * button, and is off for people who ask for reduced motion. Only the first photo loads with the
 * page; the next one loads once the page has finished loading, the rest as they are needed.
 */
export function HeroCarousel({ label, slides }: { label: string; slides: HeroBannerSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState<ReadonlySet<number>>(() => new Set([0]));
  const count = slides.length;

  /** Lets these slides' photos load. */
  const allow = useCallback(
    (indices: number[]) => {
      setReady((previous) => {
        const next = new Set(previous);
        for (const i of indices) next.add((i + count) % count);
        return next.size === previous.size ? previous : next;
      });
    },
    [count],
  );

  const go = useCallback(
    (next: number) => {
      const target = (next + count) % count;
      allow([target - 1, target, target + 1]);
      setIndex(target);
    },
    [count, allow],
  );

  // Fetch the next slide's photo only after the page itself has finished loading.
  useEffect(() => {
    const start = () => allow([1]);
    if (document.readyState === 'complete') {
      const timer = setTimeout(start, 500);
      return () => clearTimeout(timer);
    }
    window.addEventListener('load', start, { once: true });
    return () => window.removeEventListener('load', start);
  }, [allow]);

  useEffect(() => {
    if (!playing || held || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, playing, held, count, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative overflow-hidden bg-black"
      onPointerEnter={() => {
        setHeld(true);
        allow([index - 1, index + 1]);
      }}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <div
        className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => {
          const Heading = i === 0 ? 'h1' : 'h2';
          const onPhoto = Boolean(slide.image);
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              inert={i !== index}
              className="relative flex w-full shrink-0 flex-col md:block md:h-[34rem] lg:h-[38rem]"
            >
              {/* The picture: above the text on phones, behind it on wider screens. */}
              <div className="relative aspect-[16/10] w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto">
                {slide.image ? (
                  <>
                    {ready.has(i) && (
                      <Image
                        src={slide.image.src}
                        alt={slide.image.alt}
                        fill
                        sizes="100vw"
                        // The first photo is usually the largest thing on screen: fetch it first.
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        className="object-cover"
                        style={{ objectPosition: slide.image.position }}
                      />
                    )}
                    <div aria-hidden className={scrimClass(slide.align)} />
                  </>
                ) : (
                  <div aria-hidden className="absolute inset-0 bg-brand">
                    {/* The brand's Krishna drawing, turned black on saffron. */}
                    <Image
                      src="/images/krishna-flute.svg"
                      alt=""
                      width={512}
                      height={512}
                      className={`absolute top-1/2 left-1/2 h-auto w-44 -translate-x-1/2 -translate-y-1/2 brightness-0 md:w-96 ${
                        slide.align === 'right'
                          ? 'md:left-[22%]'
                          : 'md:left-auto md:right-[8%] md:translate-x-0'
                      }`}
                    />
                  </div>
                )}
              </div>

              <div
                className={`relative flex-1 md:absolute md:inset-0 md:bg-transparent ${
                  onPhoto ? 'bg-black' : 'bg-brand'
                }`}
              >
                <div className="mx-auto flex h-full max-w-7xl px-4 pt-6 pb-20 sm:px-6 md:items-center md:pt-0 md:pb-8 lg:px-8">
                  <div
                    className={`max-w-xl lg:max-w-2xl ${slide.align === 'right' ? 'md:ml-auto' : ''}`}
                  >
                    {slide.tag && (
                      <p
                        className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                          onPhoto ? 'bg-brand text-black' : 'bg-black text-white'
                        }`}
                      >
                        {slide.tag}
                      </p>
                    )}
                    <Heading
                      className={`mt-4 text-4xl leading-[1.08] font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl ${
                        onPhoto ? 'text-white' : 'text-black'
                      }`}
                    >
                      {slide.heading}
                    </Heading>
                    <p
                      className={`mt-4 text-lg leading-relaxed md:text-xl ${
                        onPhoto ? 'text-white/85' : 'text-black/80'
                      }`}
                    >
                      {slide.text}
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={slide.action.href}
                        className={onPhoto ? 'btn-brand' : 'btn-solid'}
                      >
                        {slide.action.label}
                      </Link>
                      {slide.secondary && (
                        <Link
                          href={slide.secondary.href}
                          className={onPhoto ? 'btn-light' : 'btn-outline'}
                        >
                          {slide.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          {[
            { label: 'Previous slide', step: -1, icon: ChevronLeft, side: 'left-4 lg:left-6' },
            { label: 'Next slide', step: 1, icon: ChevronRight, side: 'right-4 lg:right-6' },
          ].map(({ label: name, step, icon: Icon, side }) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={() => go(index + step)}
              className={`absolute top-1/2 hidden size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-gray-900 shadow-lg ring-1 ring-black/10 hover:bg-gray-100 md:flex ${side}`}
            >
              <Icon className="size-6" aria-hidden />
            </button>
          ))}
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-1">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${slide.heading}`}
                aria-current={i === index}
                className="group flex size-6 cursor-pointer items-center justify-center"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    i === index ? 'w-5 bg-brand' : 'w-2 bg-white/70 group-hover:bg-white'
                  }`}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? 'Pause slides' : 'Play slides'}
              className="flex size-6 cursor-pointer items-center justify-center text-white motion-reduce:hidden"
            >
              {playing ? (
                <Pause className="size-3.5" aria-hidden />
              ) : (
                <Play className="size-3.5" aria-hidden />
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

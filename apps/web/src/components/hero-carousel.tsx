'use client';

import { Pause, Play } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';

export type HeroCarouselSlide = {
  id: string;
  /** Short name on the slide's tab, e.g. "Free content". */
  label: string;
  content: ReactNode;
};

/**
 * Hero slides that rotate on their own, as a tabbed carousel. The active tab's bar fills while its
 * slide shows and moves on to the next slide when full. Rotation pauses while the pointer or
 * keyboard focus is in the carousel and stops with the pause button; with reduced motion slides
 * only change when a tab is chosen. Each slide wrapper carries `data-active`, so a slide's
 * contents can animate when it comes into view (`group-data-[active=true]/slide:`).
 */
export function HeroCarousel({ label, slides }: { label: string; slides: HeroCarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const count = slides.length;

  function select(next: number, focus = false) {
    const target = (next + count) % count;
    setIndex(target);
    if (focus) tabs.current[target]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key], true);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      {/* Slides share one grid cell, so the hero is as tall as the tallest slide and never jumps. */}
      <div className="grid grid-cols-1">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            id={`${baseId}-${slide.id}`}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.label}`}
            data-active={i === index}
            inert={i !== index}
            className={`group/slide col-start-1 row-start-1 flex min-w-0 items-center transition-[opacity,visibility] duration-500 motion-reduce:transition-none ${
              i === index ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
          >
            {slide.content}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-10 flex items-end gap-4 sm:gap-6">
          <div
            role="tablist"
            aria-label="Slides"
            className="flex min-w-0 flex-1 gap-4 sm:flex-none sm:gap-6"
          >
            {slides.map((slide, i) => {
              const selected = i === index;
              return (
                <button
                  key={slide.id}
                  ref={(element) => {
                    tabs.current[i] = element;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-${slide.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={onTabKeyDown}
                  className={`min-w-0 flex-1 cursor-pointer pb-1 text-left text-sm font-semibold sm:w-40 sm:flex-none ${
                    selected ? 'text-black' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <span className="relative mb-3 block h-0.5 overflow-hidden bg-gray-300">
                    {selected && (
                      <span
                        // A new bar for each showing, so the timer starts from empty.
                        key={index}
                        className="absolute inset-0 origin-left bg-brand motion-safe:animate-slide-timer"
                        style={{ animationPlayState: playing && !held ? 'running' : 'paused' }}
                        onAnimationEnd={() => select(index + 1)}
                      />
                    )}
                  </span>
                  <span className="block truncate">{slide.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pause slides' : 'Play slides'}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-400 text-black hover:border-black motion-reduce:hidden"
          >
            {playing ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
          </button>
        </div>
      )}
    </section>
  );
}

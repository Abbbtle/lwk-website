'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** The --motion-200 and --motion-300 tokens in globals.css, in seconds. */
const MOTION_200 = 0.2;
const MOTION_300 = 0.3;

/** GSAP's expo.out is the --ease-enter curve in globals.css. */
const EASE_ENTER = 'expo.out';

/** Items in a group follow one another by this much, and a whole group takes no longer than the cap. */
const STAGGER_EACH = 0.03;
const STAGGER_TOTAL = 0.2;

const kinds = [
  // One block, such as a section heading or a panel.
  { selector: '[data-reveal]', y: 8, duration: MOTION_300 },
  // The items of a group, such as the cards of a grid, one after another.
  { selector: '[data-reveal-group] > *', y: 4, duration: MOTION_200 },
] as const;

function staggerFor(count: number) {
  return count > 1 ? Math.min(STAGGER_EACH, STAGGER_TOTAL / (count - 1)) : 0;
}

/**
 * Fades in and lifts content as it scrolls into view: elements marked `data-reveal` move as one
 * block, and the children of `data-reveal-group` follow one another. Only content that starts below
 * the fold moves; whatever is on screen already stays still.
 *
 * Content is hidden only once this runs, so it always shows without scripts, and with reduced motion
 * nothing is hidden at all. Hidden content keeps its place and can still take keyboard focus (it is
 * see-through, not invisible). Runs again for each new `page`, and picks up content that streams in.
 *
 * @param scope Selector of the element whose content is revealed, e.g. '#main'.
 * @param page Changes when a new page shows, e.g. the pathname.
 */
export function useReveal(scope: string, page: string) {
  useGSAP(
    () => {
      const root = document.querySelector(scope);
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', (context) => {
        const seen = new WeakSet<Element>();
        const scan = context.add('scan', () => {
          const fold = window.innerHeight;
          for (const { selector, y, duration } of kinds) {
            const targets = [...root.querySelectorAll(selector)].filter((element) => {
              if (seen.has(element)) return false;
              seen.add(element);
              return element.getBoundingClientRect().top >= fold;
            });
            if (targets.length === 0) continue;
            gsap.set(targets, { opacity: 0, y });
            ScrollTrigger.batch(targets, {
              start: 'top 95%',
              onEnter: (batch, triggers) => {
                gsap.to(batch, {
                  opacity: 1,
                  y: 0,
                  duration,
                  ease: EASE_ENTER,
                  stagger: staggerFor(batch.length),
                  overwrite: true,
                  clearProps: 'opacity,transform',
                });
                for (const trigger of triggers) trigger.kill();
              },
              // Jumped past in one go (End key, a link further down the page): just show it.
              onLeave: (batch, triggers) => {
                gsap.set(batch, { clearProps: 'opacity,transform' });
                for (const trigger of triggers) trigger.kill();
              },
            });
          }
        });
        scan();
        ScrollTrigger.refresh();

        // Content that streams in later, or a page that changes height: find new blocks, remeasure.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const observer = new ResizeObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            scan();
            ScrollTrigger.refresh();
          }, 200);
        });
        observer.observe(root);
        return () => {
          observer.disconnect();
          clearTimeout(timer);
        };
      });
      return () => mm.revert();
    },
    { scope, dependencies: [scope, page], revertOnUpdate: true },
  );
}

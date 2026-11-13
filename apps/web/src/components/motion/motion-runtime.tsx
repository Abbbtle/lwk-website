'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useReveal } from './use-reveal';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Smooth wheel scrolling, for a mouse or trackpad only and never with reduced motion. Touch screens
 * keep their own scrolling, and are spared a loop that would run on every frame.
 */
const SMOOTH_WHEEL =
  '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)';

/** While a dialog or the mobile menu is open, the page behind it stays where it is. */
const OVERLAY = 'dialog[open], [aria-controls="mobile-menu"][aria-expanded="true"]';

/**
 * The site's motion, loaded by SmoothScroll once the page has loaded: Lenis smooth scrolling driven
 * by GSAP's ticker, scroll reveals in the main content (see useReveal), and a jump to the top of
 * each new page.
 */
export default function MotionRuntime() {
  const pathname = usePathname();
  const lenis = useRef<Lenis | null>(null);
  const firstPage = useRef(true);
  const historyMove = useRef(false);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(SMOOTH_WHEEL, () => {
      const instance = new Lenis({
        stopInertiaOnNavigate: true,
        // Text boxes scroll their own text.
        prevent: (node) => node.tagName === 'TEXTAREA',
      });
      instance.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => instance.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const follow = () => (document.querySelector(OVERLAY) ? instance.stop() : instance.start());
      const observer = new MutationObserver(follow);
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['open', 'aria-expanded'],
      });
      follow();
      lenis.current = instance;

      return () => {
        observer.disconnect();
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        instance.destroy();
        lenis.current = null;
      };
    });
    return () => mm.revert();
  });

  useEffect(() => {
    const onPopState = () => {
      historyMove.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A new page starts at the top, at once. Back and forward keep their place, and a link to a part
  // of a page goes there. Runs before the reveals below, so they measure the page from the top.
  useLayoutEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    if (!historyMove.current && !window.location.hash) {
      if (lenis.current) lenis.current.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    }
    historyMove.current = false;
  }, [pathname]);

  // Sets up each page's reveals and refreshes ScrollTrigger's measurements.
  useReveal('#main', pathname);

  return null;
}

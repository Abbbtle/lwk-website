'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// GSAP, ScrollTrigger and Lenis (about 52 KB gzipped) come in a chunk of their own, fetched once the
// page has loaded, so they never hold up the first paint or compete with the banner photo. If the
// chunk cannot be fetched (a dropped connection), the site simply goes without motion.
const MotionRuntime = dynamic(
  () => import('./motion-runtime').catch(() => ({ default: () => null })),
  { ssr: false },
);

/** Elements that take keyboard focus without help. */
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

/**
 * The element a click is taking the visitor to, when it is a plain click on a link to a part of
 * the current page (such as the skip link); otherwise null.
 */
export function samePageTarget(event: MouseEvent): HTMLElement | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return null;
  const link = event.target instanceof Element ? event.target.closest('a[href*="#"]') : null;
  if (!(link instanceof HTMLAnchorElement)) return null;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash)
    return null;
  return document.getElementById(decodeURIComponent(url.hash.slice(1)));
}

/** Moves keyboard focus to a link's target, after the page has scrolled there. */
function focusTarget(target: HTMLElement) {
  if (!target.matches(FOCUSABLE)) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Smooth scrolling and scroll reveals for the whole site; mounted once, in the root layout. The
 * motion code waits until the page has loaded and the browser is idle. Links to a part of the
 * current page (such as the skip link) move keyboard focus there as well as scrolling.
 */
export function SmoothScroll() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if ('requestIdleCallback' in window) {
        idle = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      } else {
        timer = setTimeout(() => setReady(true), 200);
      }
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = samePageTarget(event);
      // Two frames: the browser (or the router, for a Link) scrolls first.
      if (target) requestAnimationFrame(() => requestAnimationFrame(() => focusTarget(target)));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return ready ? <MotionRuntime /> : null;
}

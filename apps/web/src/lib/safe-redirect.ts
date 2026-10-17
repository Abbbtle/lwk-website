/**
 * Only allow redirects to paths on this site, so sign-in links cannot send people elsewhere
 * (open redirect). Anything else falls back to `fallback`.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  try {
    const base = 'http://return-to.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

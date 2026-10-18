import 'server-only';
import { headers } from 'next/headers';

/**
 * The visitor's IP address. In AWS every request arrives through CloudFront, which sets
 * `CloudFront-Viewer-Address` ("ip:port") itself, so the value cannot be spoofed by the client.
 * Locally there is no CloudFront; requests are grouped under "local".
 */
export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export function ipFromHeaders(h: Headers): string {
  const viewer = h.get('cloudfront-viewer-address');
  if (viewer) {
    // "198.51.100.10:46532" or "2001:db8::1:46532": the port follows the last colon.
    const ip = viewer.slice(0, viewer.lastIndexOf(':'));
    if (ip) return ip.replace(/^\[|\]$/g, '');
  }
  return 'local';
}

/**
 * The visitor's country as an ISO 3166-1 alpha-2 code ("ZA"), or null when unknown. CloudFront
 * sets `CloudFront-Viewer-Country` itself from the visitor's IP address (the origin request policy
 * forwards it). Outside production, `PRICE_COUNTRY` stands in for it, so other countries' prices
 * can be tried locally; production ignores it.
 */
export async function viewerCountry(): Promise<string | null> {
  return countryFromHeaders(await headers());
}

export function countryFromHeaders(h: Headers): string | null {
  const standIn = process.env.NODE_ENV === 'production' ? undefined : process.env.PRICE_COUNTRY;
  const code = (standIn || h.get('cloudfront-viewer-country'))?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/** CloudFront's request ID, for matching log lines to a request. */
export async function requestId(): Promise<string | undefined> {
  return (await headers()).get('x-amz-cf-id') ?? undefined;
}

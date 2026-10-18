import 'server-only';
import { headers } from 'next/headers';
import { type CountryCode, toCountryCode } from '@/lib/country-code';

/**
 * The visitor's IP address. In AWS every request arrives through CloudFront, which sets
 * `CloudFront-Viewer-Address` ("ip:port") itself, so the value cannot be spoofed by the client.
 * Locally there is no CloudFront; requests are grouped under "local".
 */
export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export function ipFromHeaders(requestHeaders: Headers): string {
  const viewer = requestHeaders.get('cloudfront-viewer-address');
  if (viewer) {
    // "198.51.100.10:46532" or "2001:db8::1:46532": the port follows the last colon.
    const ip = viewer.slice(0, viewer.lastIndexOf(':'));
    if (ip) return ip.replace(/^\[|\]$/g, '');
  }
  return 'local';
}

/**
 * The visitor's country. CloudFront sets `CloudFront-Viewer-Country` itself from the visitor's IP
 * address (the origin request policy forwards it); null when it is missing or not a country code,
 * as locally, where there is no CloudFront.
 */
export async function viewerCountry(): Promise<CountryCode | null> {
  return countryFromHeaders(await headers());
}

export function countryFromHeaders(requestHeaders: Headers): CountryCode | null {
  return toCountryCode(requestHeaders.get('cloudfront-viewer-country'));
}

/** CloudFront's request ID, for matching log lines to a request. */
export async function requestId(): Promise<string | undefined> {
  return (await headers()).get('x-amz-cf-id') ?? undefined;
}

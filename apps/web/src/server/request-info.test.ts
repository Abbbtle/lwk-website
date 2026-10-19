import { afterEach, describe, expect, it, vi } from 'vitest';
import { countryFromHeaders, ipFromHeaders } from './request-info';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ipFromHeaders', () => {
  it('reads the viewer address CloudFront sets, for IPv4 and IPv6', () => {
    expect(ipFromHeaders(new Headers({ 'cloudfront-viewer-address': '198.51.100.10:46532' }))).toBe(
      '198.51.100.10',
    );
    expect(ipFromHeaders(new Headers({ 'cloudfront-viewer-address': '2001:db8::1:46532' }))).toBe(
      '2001:db8::1',
    );
  });

  it('ignores X-Forwarded-For, which visitors can set themselves', () => {
    expect(ipFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('local');
  });
});

describe('countryFromHeaders', () => {
  const fromCloudFront = (country: string) => new Headers({ 'cloudfront-viewer-country': country });

  it('reads the country CloudFront sets', () => {
    expect(countryFromHeaders(fromCloudFront('ZA'))).toBe('ZA');
    expect(countryFromHeaders(fromCloudFront('gb'))).toBe('GB');
  });

  it('is null without a country code', () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
    for (const value of ['', 'UK', 'USA', 'XX']) {
      expect(countryFromHeaders(fromCloudFront(value)), value).toBeNull();
    }
  });

  it('reads only the header, not PRICE_COUNTRY', () => {
    vi.stubEnv('PRICE_COUNTRY', 'IN');
    expect(countryFromHeaders(fromCloudFront('ZA'))).toBe('ZA');
    expect(countryFromHeaders(new Headers())).toBeNull();
  });
});

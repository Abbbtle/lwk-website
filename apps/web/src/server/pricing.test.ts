import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewerPriceRegion } from './pricing';
import { countryFromHeaders } from './request-info';

// The incoming request's headers, as `next/headers` gives them to a page.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => request.headers }));

const fromCloudFront = (country: string) => new Headers({ 'cloudfront-viewer-country': country });

beforeEach(() => {
  // A PRICE_COUNTRY in .env.local would otherwise stand in for every header below.
  vi.stubEnv('PRICE_COUNTRY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('countryFromHeaders', () => {
  it('reads the country CloudFront sets, in capitals', () => {
    expect(countryFromHeaders(fromCloudFront('ZA'))).toBe('ZA');
    expect(countryFromHeaders(fromCloudFront('gb'))).toBe('GB');
  });

  it('is null without a usable country', () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
    expect(countryFromHeaders(fromCloudFront(''))).toBeNull();
    expect(countryFromHeaders(fromCloudFront('ZAF'))).toBeNull();
  });

  it('lets PRICE_COUNTRY stand in for it outside production only', () => {
    vi.stubEnv('PRICE_COUNTRY', 'in');
    expect(countryFromHeaders(fromCloudFront('ZA'))).toBe('IN');
    vi.stubEnv('NODE_ENV', 'production');
    expect(countryFromHeaders(fromCloudFront('ZA'))).toBe('ZA');
    expect(countryFromHeaders(new Headers())).toBeNull();
  });
});

describe('viewerPriceRegion', () => {
  it("follows the visitor's country", async () => {
    request.headers = fromCloudFront('IN');
    expect(await viewerPriceRegion()).toBe('india');
    request.headers = fromCloudFront('US');
    expect(await viewerPriceRegion()).toBe('high-income');
    request.headers = fromCloudFront('BR');
    expect(await viewerPriceRegion()).toBe('rest-of-world');
  });

  it('shows South African prices when the country is unknown', async () => {
    request.headers = new Headers();
    expect(await viewerPriceRegion()).toBe('south-africa');
  });
});

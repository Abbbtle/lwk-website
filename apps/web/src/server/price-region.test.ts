import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_PRICE_REGION } from '@/lib/pricing';
import { standInCountry, viewerPriceRegion } from './price-region';

// The incoming request's headers, as `next/headers` gives them to a page.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => request.headers }));

const fromCloudFront = (country: string) => new Headers({ 'cloudfront-viewer-country': country });

beforeEach(() => {
  // A PRICE_COUNTRY in .env.local would otherwise stand in for every visitor below.
  vi.stubEnv('PRICE_COUNTRY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('viewerPriceRegion', () => {
  it("follows the visitor's country", async () => {
    const regions: Record<string, string> = {
      ZA: 'south-africa',
      IN: 'india',
      US: 'high-income',
      BR: 'rest-of-world',
    };
    for (const [country, region] of Object.entries(regions)) {
      request.headers = fromCloudFront(country);
      expect(await viewerPriceRegion(), country).toBe(region);
    }
  });

  it('shows the home region when the country is unknown', async () => {
    expect(HOME_PRICE_REGION).toBe('south-africa');
    for (const headers of [new Headers(), fromCloudFront('UK'), fromCloudFront('XX')]) {
      request.headers = headers;
      expect(await viewerPriceRegion()).toBe(HOME_PRICE_REGION);
    }
  });

  it('lets PRICE_COUNTRY stand in for the visitor outside production', async () => {
    request.headers = fromCloudFront('ZA');
    vi.stubEnv('PRICE_COUNTRY', 'in');
    expect(await viewerPriceRegion()).toBe('india');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await viewerPriceRegion()).toBe('south-africa');
  });
});

describe('standInCountry', () => {
  it('reads PRICE_COUNTRY outside production only', () => {
    expect(standInCountry({ NODE_ENV: 'development', PRICE_COUNTRY: 'in' })).toBe('IN');
    expect(standInCountry({ NODE_ENV: 'test', PRICE_COUNTRY: 'GB' })).toBe('GB');
    expect(standInCountry({ NODE_ENV: 'production', PRICE_COUNTRY: 'IN' })).toBeNull();
  });

  it('ignores a missing value or one that is not a country code', () => {
    expect(standInCountry({ NODE_ENV: 'development' })).toBeNull();
    expect(standInCountry({ NODE_ENV: 'development', PRICE_COUNTRY: 'UK' })).toBeNull();
  });
});

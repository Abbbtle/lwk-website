import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, type CountryCode, toCountryCode } from '@/lib/country-code';
import {
  HOME_PRICE_REGION,
  PRICE_REGIONS,
  regionCurrency,
  regionForCountry,
  regionName,
  regionTaxNote,
  visitorRegionPhrase,
} from './regions';

function country(code: string): CountryCode {
  const checked = toCountryCode(code);
  if (!checked) throw new Error(`${code} is not a country code`);
  return checked;
}

const regionOf = (code: string) => regionForCountry(country(code));

describe('regionForCountry', () => {
  it('gives South Africa and India their own regions', () => {
    expect(regionOf('ZA')).toBe('south-africa');
    expect(regionOf('IN')).toBe('india');
  });

  it('groups high-income countries and territories', () => {
    for (const code of ['US', 'GB', 'DE', 'JP', 'AU', 'AE', 'SG', 'HK', 'RU', 'UY', 'JE', 'BM']) {
      expect(regionOf(code), code).toBe('high-income');
    }
  });

  it('puts every other country in the rest of the world', () => {
    for (const code of ['BR', 'NG', 'KE', 'PK', 'MX', 'CN', 'LK', 'BW']) {
      expect(regionOf(code), code).toBe('rest-of-world');
    }
  });

  it('places every country in a region and leaves no region empty', () => {
    const reached = new Set(COUNTRY_CODES.map(regionOf));
    expect([...reached].sort()).toEqual([...PRICE_REGIONS].sort());
  });

  it('knows all 88 high-income economies by real country codes', () => {
    // A mistyped code in the World Bank list would match no country, and the count would drop.
    expect(COUNTRY_CODES.filter((code) => regionOf(code) === 'high-income')).toHaveLength(88);
  });

  it('leaves unknown countries to the caller, who uses the home region', () => {
    expect(HOME_PRICE_REGION).toBe('south-africa');
  });
});

describe('region wording', () => {
  it('gives each region a currency, a phrase for its visitors and a tax note', () => {
    expect(
      PRICE_REGIONS.map((region) => [
        regionCurrency(region),
        visitorRegionPhrase(region),
        regionTaxNote(region),
      ]),
    ).toEqual([
      ['ZAR', 'South Africa', 'including VAT'],
      ['USD', 'the US, UK, Europe and similar countries', 'including local taxes'],
      ['INR', 'India', 'including GST'],
      ['USD', 'your region', 'including local taxes'],
    ]);
  });

  it('names each region for lists of every region', () => {
    expect(PRICE_REGIONS.map(regionName)).toEqual([
      'South Africa',
      'The US, UK, Europe and similar countries',
      'India',
      'Rest of the world',
    ]);
  });
});

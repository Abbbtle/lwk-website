import { describe, expect, it } from 'vitest';
import {
  PRICE_REGIONS,
  regionCurrency,
  regionForCountry,
  regionName,
  regionTaxNote,
  visitorRegionPhrase,
} from './regions';

describe('regionForCountry', () => {
  it('gives South Africa and India their own regions', () => {
    expect(regionForCountry('ZA')).toBe('south-africa');
    expect(regionForCountry('IN')).toBe('india');
  });

  it('groups high-income countries', () => {
    for (const code of ['US', 'GB', 'DE', 'JP', 'AU', 'AE', 'SG', 'HK', 'JE', 'PR', 'RU', 'UY']) {
      expect(regionForCountry(code), code).toBe('high-income');
    }
  });

  it('puts every other country in the rest of the world', () => {
    for (const code of ['BR', 'NG', 'KE', 'PK', 'MX', 'CN', 'LK', 'BW']) {
      expect(regionForCountry(code), code).toBe('rest-of-world');
    }
  });

  it('reads codes in any case and ignores surrounding spaces', () => {
    expect(regionForCountry('za')).toBe('south-africa');
    expect(regionForCountry('in')).toBe('india');
    expect(regionForCountry(' gb ')).toBe('high-income');
    expect(regionForCountry('br')).toBe('rest-of-world');
  });

  it('treats a missing or unrecognised country as South Africa', () => {
    for (const code of [null, undefined, '', '  ', 'ZAF', 'Z', '1A', 'G B']) {
      expect(regionForCountry(code), String(code)).toBe('south-africa');
    }
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

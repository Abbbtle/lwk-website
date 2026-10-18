import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, toCountryCode } from './country-code';

describe('COUNTRY_CODES', () => {
  it('lists the 249 assigned codes once each, in order', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect([...COUNTRY_CODES].sort()).toEqual(COUNTRY_CODES);
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });
});

describe('toCountryCode', () => {
  it('accepts assigned codes in any case, ignoring surrounding spaces', () => {
    expect(toCountryCode('ZA')).toBe('ZA');
    expect(toCountryCode(' gb ')).toBe('GB');
    expect(toCountryCode('je')).toBe('JE');
  });

  it('is null for anything else', () => {
    const notCodes = [null, undefined, '', '  ', 'UK', 'USA', 'IND', 'United Kingdom', 'XX', 'G B'];
    for (const value of notCodes) {
      expect(toCountryCode(value), String(value)).toBeNull();
    }
  });
});

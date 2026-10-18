import { describe, expect, it } from 'vitest';
import { toCountryCode } from './country-code';

describe('toCountryCode', () => {
  it('accepts two letters in any case, ignoring surrounding spaces', () => {
    expect(toCountryCode('ZA')).toBe('ZA');
    expect(toCountryCode(' gb ')).toBe('GB');
  });

  it('is null for anything else', () => {
    for (const value of [null, undefined, '', '  ', 'ZAF', 'Z', '1A', 'G B']) {
      expect(toCountryCode(value), String(value)).toBeNull();
    }
  });
});

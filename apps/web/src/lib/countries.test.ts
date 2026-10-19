import { describe, expect, it } from 'vitest';
import { countries } from './countries';

describe('countries', () => {
  it('offers nationalities, not territories or uninhabited areas', () => {
    expect(countries).toHaveLength(199);
    expect(countries).toEqual(expect.arrayContaining(['India', 'South Africa', 'United Kingdom']));
    expect(countries).not.toContain('Jersey');
    expect(countries).not.toContain('Antarctica');
  });
});

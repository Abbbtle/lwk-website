import { afterEach, describe, expect, it, vi } from 'vitest';
import { earlyAccessEndsAt, formatEarlyAccessEnd, salesPhase } from './early-access';

afterEach(() => {
  vi.unstubAllEnvs();
});

const END = new Date('2027-03-01T00:00:00+02:00');

describe('salesPhase', () => {
  it('stays in early access while no end is set', () => {
    expect(salesPhase(null, new Date('2030-01-01T00:00:00Z'))).toBe('early_access');
  });

  it('is early access before the end and paid plans from the end on, for good', () => {
    expect(salesPhase(END, new Date(END.getTime() - 1))).toBe('early_access');
    expect(salesPhase(END, END)).toBe('paid');
    expect(salesPhase(END, new Date('2040-01-01T00:00:00Z'))).toBe('paid');
  });
});

describe('earlyAccessEndsAt', () => {
  it('is null while EARLY_ACCESS_ENDS_AT is unset or empty', () => {
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '');
    expect(earlyAccessEndsAt()).toBeNull();
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '  ');
    expect(earlyAccessEndsAt()).toBeNull();
  });

  it('reads an ISO date-time with its time zone', () => {
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '2027-03-01T00:00:00+02:00');
    expect(earlyAccessEndsAt()).toEqual(END);
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '2027-02-28T22:00Z');
    expect(earlyAccessEndsAt()).toEqual(END);
  });

  it('refuses anything else rather than guessing the phase', () => {
    for (const value of ['2027-03-01', '2027-03-01T00:00:00', '1 March 2027', 'soon']) {
      vi.stubEnv('EARLY_ACCESS_ENDS_AT', value);
      expect(() => earlyAccessEndsAt(), value).toThrow('EARLY_ACCESS_ENDS_AT must be');
    }
  });
});

describe('formatEarlyAccessEnd', () => {
  it('names the day as it falls in South Africa', () => {
    expect(formatEarlyAccessEnd(END)).toBe('1 March 2027');
  });
});

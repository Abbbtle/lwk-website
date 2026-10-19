import { afterEach, describe, expect, it, vi } from 'vitest';
import { EARLY_ACCESS_ENDS_AT } from '@/lib/early-access';
import { currentSalesMoment, earlyAccessEndsAt, standInEarlyAccessEnd } from './early-access';

afterEach(() => {
  vi.unstubAllEnvs();
});

const END = new Date('2027-03-01T00:00:00+02:00');

describe('the end of early access on the server', () => {
  it('is the reviewed constant when nothing stands in for it', () => {
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '');
    expect(earlyAccessEndsAt()).toBe(EARLY_ACCESS_ENDS_AT);
  });

  it('lets EARLY_ACCESS_ENDS_AT stand in for the constant outside production only', () => {
    expect(
      standInEarlyAccessEnd({
        NODE_ENV: 'test',
        EARLY_ACCESS_ENDS_AT: '2027-03-01T00:00:00+02:00',
      }),
    ).toEqual(END);
    expect(
      standInEarlyAccessEnd({
        NODE_ENV: 'production',
        EARLY_ACCESS_ENDS_AT: '2027-03-01T00:00:00+02:00',
      }),
    ).toBeNull();
    expect(
      standInEarlyAccessEnd({ NODE_ENV: 'development', EARLY_ACCESS_ENDS_AT: ' ' }),
    ).toBeNull();
  });

  it('stops with a clear error on a malformed stand-in', () => {
    for (const value of ['2027-03-01', '1 March 2027', 'soon']) {
      expect(
        () => standInEarlyAccessEnd({ NODE_ENV: 'development', EARLY_ACCESS_ENDS_AT: value }),
        value,
      ).toThrow(`EARLY_ACCESS_ENDS_AT: Expected an ISO date-time with a time zone`);
    }
  });

  it('gives pages the phase with the end date', () => {
    vi.stubEnv('EARLY_ACCESS_ENDS_AT', '2020-01-01T00:00:00Z');
    expect(currentSalesMoment()).toEqual({
      phase: 'paid',
      earlyAccessEndsAt: new Date('2020-01-01T00:00:00Z'),
    });
  });
});

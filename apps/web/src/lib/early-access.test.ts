import { describe, expect, it } from 'vitest';
import {
  EARLY_ACCESS_ENDS_AT,
  formatEarlyAccessEnd,
  isoDateTime,
  salesPhase,
} from './early-access';

const END = new Date('2027-03-01T00:00:00+02:00');

describe('EARLY_ACCESS_ENDS_AT', () => {
  it('is not set yet, or is a real moment written with its time zone', () => {
    // Its type only accepts what isoDateTime makes, so a set end always had a time zone.
    if (EARLY_ACCESS_ENDS_AT !== null) {
      expect(Number.isNaN(EARLY_ACCESS_ENDS_AT.getTime())).toBe(false);
      expect(isoDateTime(EARLY_ACCESS_ENDS_AT.toISOString())).toEqual(EARLY_ACCESS_ENDS_AT);
    } else {
      expect(EARLY_ACCESS_ENDS_AT).toBeNull();
    }
  });
});

describe('isoDateTime', () => {
  it('reads an ISO date-time with its time zone', () => {
    expect(isoDateTime('2027-03-01T00:00:00+02:00')).toEqual(END);
    expect(isoDateTime('2027-02-28T22:00Z')).toEqual(END);
  });

  it('refuses anything without a time zone, or that is not a date-time', () => {
    for (const value of [
      '2027-03-01',
      '2027-03-01T00:00:00',
      '1 March 2027',
      '2027-13-01T00:00Z',
    ]) {
      expect(() => isoDateTime(value), value).toThrow(RangeError);
    }
  });
});

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

describe('formatEarlyAccessEnd', () => {
  it('names the day as it falls in South Africa', () => {
    expect(formatEarlyAccessEnd(END)).toBe('1 March 2027');
  });
});

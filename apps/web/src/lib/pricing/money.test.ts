import { describe, expect, it } from 'vitest';
import { formatMoney, isCurrency, type Money, money, toDecimalString } from './money';

describe('money', () => {
  it('holds a whole, non-negative number of minor units', () => {
    expect(money('ZAR', 19900)).toEqual({ currency: 'ZAR', minorUnits: 19900 });
    expect(money('USD', 0).minorUnits).toBe(0);
  });

  it('refuses anything else', () => {
    expect(() => money('ZAR', 999.5)).toThrow(
      new RangeError('Expected a whole, non-negative number of ZAR minor units but got 999.5.'),
    );
    for (const minorUnits of [-5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => money('USD', minorUnits), String(minorUnits)).toThrow(RangeError);
    }
  });
});

describe('isCurrency', () => {
  it('recognises the currencies the site uses and nothing else', () => {
    expect(['ZAR', 'USD', 'INR'].every((code) => isCurrency(code))).toBe(true);
    for (const value of ['EUR', 'zar', '', null, 840]) {
      expect(isCurrency(value), String(value)).toBe(false);
    }
  });
});

describe('formatMoney', () => {
  it('shows whole amounts without cents', () => {
    expect(formatMoney(money('ZAR', 9900))).toBe('R99');
    expect(formatMoney(money('ZAR', 129900))).toBe('R1,299');
    expect(formatMoney(money('USD', 1000))).toBe('$10');
    expect(formatMoney(money('ZAR', 0))).toBe('R0');
  });

  it('shows cents when the amount has them', () => {
    expect(formatMoney(money('USD', 999))).toBe('$9.99');
    expect(formatMoney(money('USD', 12999))).toBe('$129.99');
    expect(formatMoney(money('USD', 250))).toBe('$2.50');
    expect(formatMoney(money('ZAR', 9950))).toBe('R99.50');
  });

  it('groups rupees the Indian way', () => {
    expect(formatMoney(money('INR', 249900))).toBe('₹2,499');
    expect(formatMoney(money('INR', 10000000))).toBe('₹1,00,000');
    expect(formatMoney(money('INR', 20825))).toBe('₹208.25');
  });
});

describe('toDecimalString', () => {
  it('writes the amount with two decimals, as schema.org prices are written', () => {
    expect(toDecimalString(money('ZAR', 19900))).toBe('199.00');
    expect(toDecimalString(money('USD', 1999))).toBe('19.99');
    expect(toDecimalString(money('INR', 249900))).toBe('2499.00');
    expect(toDecimalString(money('USD', 5))).toBe('0.05');
    expect(toDecimalString(money('USD', 0))).toBe('0.00');
  });

  it('refuses amounts that were not made by money()', () => {
    const forged = { currency: 'USD', minorUnits: 999.5 } as Money;
    expect(() => toDecimalString(forged)).toThrow(RangeError);
    expect(() => formatMoney({ currency: 'USD', minorUnits: -5 } as Money)).toThrow(RangeError);
  });
});

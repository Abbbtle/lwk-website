import { describe, expect, it } from 'vitest';
import { type Currency, decimalAmount, formatMoney } from './money';

const money = (currency: Currency, minorUnits: number) => ({ currency, minorUnits });

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

describe('decimalAmount', () => {
  it('writes the amount with two decimals', () => {
    expect(decimalAmount(money('ZAR', 19900))).toBe('199.00');
    expect(decimalAmount(money('USD', 1999))).toBe('19.99');
    expect(decimalAmount(money('INR', 249900))).toBe('2499.00');
    expect(decimalAmount(money('USD', 5))).toBe('0.05');
    expect(decimalAmount(money('USD', 0))).toBe('0.00');
  });
});

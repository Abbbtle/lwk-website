import { describe, expect, it } from 'vitest';
import { type Money, money } from './money';
import {
  billingPeriodPhrase,
  formatRecurring,
  monthlyEquivalent,
  perSeatPhrase,
  type RecurringPrice,
  yearlySavingPercent,
} from './recurring';

const monthly = (amount: Money): RecurringPrice => ({ amount, period: 'month' });
const yearly = (amount: Money): RecurringPrice => ({ amount, period: 'year' });

describe('recurring prices', () => {
  it('say what they are for', () => {
    expect(billingPeriodPhrase('month')).toBe('a month');
    expect(billingPeriodPhrase('year')).toBe('a year');
    expect(perSeatPhrase('year')).toBe('a seat a year');
    expect(formatRecurring(monthly(money('ZAR', 9900)))).toBe('R99 a month');
    expect(formatRecurring(yearly(money('INR', 249900)))).toBe('₹2,499 a year');
  });

  it('spread a yearly price over 12 months, rounding up', () => {
    expect(formatRecurring(monthlyEquivalent(yearly(money('INR', 249900))))).toBe(
      '₹208.25 a month',
    );
    // $29.99 / 12 is $2.499..., shown as $2.50 so the monthly figure never understates the price.
    expect(formatRecurring(monthlyEquivalent(yearly(money('USD', 2999))))).toBe('$2.50 a month');
    expect(() => monthlyEquivalent(monthly(money('USD', 999)))).toThrow('Expected a yearly price.');
  });
});

describe('yearlySavingPercent', () => {
  it('is what paying yearly saves over 12 monthly payments', () => {
    const saving = yearlySavingPercent({
      monthly: monthly(money('ZAR', 9900)),
      yearly: yearly(money('ZAR', 79900)),
    });
    expect(saving).toBe(33);
  });

  it('refuses swapped periods, mixed currencies and a free month', () => {
    const rands = { monthly: monthly(money('ZAR', 9900)), yearly: yearly(money('ZAR', 79900)) };
    expect(() => yearlySavingPercent({ monthly: rands.yearly, yearly: rands.monthly })).toThrow(
      'Expected a monthly and a yearly price.',
    );
    expect(() =>
      yearlySavingPercent({ monthly: monthly(money('USD', 999)), yearly: rands.yearly }),
    ).toThrow('Expected one currency but got USD monthly and ZAR yearly.');
    expect(() =>
      yearlySavingPercent({ monthly: monthly(money('ZAR', 0)), yearly: rands.yearly }),
    ).toThrow('Expected a monthly price above zero.');
  });
});

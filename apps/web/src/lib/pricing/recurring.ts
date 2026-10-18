import { formatMoney, type Money, money } from './money';

// Prices paid every month or every year, and how they are said.

export type BillingPeriod = 'month' | 'year';

/** A price paid every month or every year. */
export type RecurringPrice = { readonly amount: Money; readonly period: BillingPeriod };

const MONTHS_IN_A_YEAR = 12;

const periodPhrases: Record<BillingPeriod, string> = { month: 'a month', year: 'a year' };

/** "a month", "a year". */
export function billingPeriodPhrase(period: BillingPeriod): string {
  return periodPhrases[period];
}

/** "a seat a year", for a price paid for each seat. */
export function perSeatPhrase(period: BillingPeriod): string {
  return `a seat ${billingPeriodPhrase(period)}`;
}

/** "R99 a month", "₹2,499 a year". */
export function formatRecurring({ amount, period }: RecurringPrice): string {
  return `${formatMoney(amount)} ${billingPeriodPhrase(period)}`;
}

/** A yearly price spread over 12 months, rounded up so it never understates the yearly price. */
export function monthlyEquivalent(yearly: RecurringPrice): RecurringPrice {
  if (yearly.period !== 'year') throw new RangeError('Expected a yearly price.');
  const { currency, minorUnits } = yearly.amount;
  return { amount: money(currency, Math.ceil(minorUnits / MONTHS_IN_A_YEAR)), period: 'month' };
}

/** What paying yearly saves over 12 monthly payments, in whole percent: 33. */
export function yearlySavingPercent({
  monthly,
  yearly,
}: {
  monthly: RecurringPrice;
  yearly: RecurringPrice;
}): number {
  if (monthly.period !== 'month' || yearly.period !== 'year') {
    throw new RangeError('Expected a monthly and a yearly price.');
  }
  const [perMonth, perYear] = [monthly.amount, yearly.amount];
  if (perMonth.currency !== perYear.currency) {
    throw new RangeError(
      `Expected one currency but got ${perMonth.currency} monthly and ${perYear.currency} yearly.`,
    );
  }
  if (perMonth.minorUnits <= 0) throw new RangeError('Expected a monthly price above zero.');
  return Math.round((1 - perYear.minorUnits / (perMonth.minorUnits * MONTHS_IN_A_YEAR)) * 100);
}

// Amounts of money and how they are shown. Amounts are whole minor units (cents, paise), so sums
// and comparisons are exact.

export type Currency = 'ZAR' | 'USD' | 'INR';

/** An amount in a currency's minor units: `{ currency: 'ZAR', minorUnits: 19900 }` is R199. */
export type Money = { readonly currency: Currency; readonly minorUnits: number };

// All three currencies have 100 minor units. Symbols are fixed rather than taken from Intl's
// currency style, which differs between locales and browsers ("ZAR 99.00", "R 99,00").
const MINOR_UNITS = 100;
const currencyFormats: Record<Currency, { symbol: string; locale: string }> = {
  ZAR: { symbol: 'R', locale: 'en-US' },
  USD: { symbol: '$', locale: 'en-US' },
  // Indian digit grouping, as in ₹1,00,000.
  INR: { symbol: '₹', locale: 'en-IN' },
};

/** "R99", "R1,299", "$9.99", "₹2,499": cents only when the amount has them. */
export function formatMoney({ currency, minorUnits }: Money): string {
  const { symbol, locale } = currencyFormats[currency];
  const fractionDigits = minorUnits % MINOR_UNITS === 0 ? 0 : 2;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minorUnits / MINOR_UNITS);
  return `${symbol}${amount}`;
}

/** The amount as a plain decimal, "199.00", as schema.org (and payment providers) expect. */
export function decimalAmount({ minorUnits }: Money): string {
  const units = Math.floor(minorUnits / MINOR_UNITS);
  const cents = String(minorUnits % MINOR_UNITS).padStart(2, '0');
  return `${units}.${cents}`;
}

// Amounts of money and how they are shown. An amount is a whole number of minor units (cents,
// paise), so sums and comparisons are exact. Payment providers take minor units too, so their
// payloads use `minorUnits` as it is; decimal strings are only for schema.org.

export const CURRENCIES = ['ZAR', 'USD', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}

declare const checked: unique symbol;

/** An amount in a currency's minor units: R199 is 19900 ZAR minor units. Made by `money` only. */
export type Money = {
  readonly currency: Currency;
  readonly minorUnits: number;
  readonly [checked]: true;
};

// All three currencies have 100 minor units. Symbols are fixed rather than taken from Intl's
// currency style, which differs between locales and browsers ("ZAR 99.00", "R 99,00").
const MINOR_UNITS_PER_UNIT = 100;
const currencyFormats: Record<Currency, { symbol: string; locale: string }> = {
  ZAR: { symbol: 'R', locale: 'en-US' },
  USD: { symbol: '$', locale: 'en-US' },
  // Indian digit grouping, as in ₹1,00,000.
  INR: { symbol: '₹', locale: 'en-IN' },
};

function assertWholeMinorUnits(currency: Currency, minorUnits: number) {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new RangeError(
      `Expected a whole, non-negative number of ${currency} minor units but got ${minorUnits}.`,
    );
  }
}

/** Money in a currency. Throws a RangeError unless `minorUnits` is a whole, non-negative number. */
export function money(currency: Currency, minorUnits: number): Money {
  assertWholeMinorUnits(currency, minorUnits);
  return { currency, minorUnits } as Money;
}

/** "R99", "R1,299", "$9.99", "₹2,499": cents only when the amount has them. */
export function formatMoney({ currency, minorUnits }: Money): string {
  assertWholeMinorUnits(currency, minorUnits);
  const { symbol, locale } = currencyFormats[currency];
  const fractionDigits = minorUnits % MINOR_UNITS_PER_UNIT === 0 ? 0 : 2;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minorUnits / MINOR_UNITS_PER_UNIT);
  return `${symbol}${amount}`;
}

/** The amount as schema.org writes prices: a decimal string with two places, "199.00". */
export function toDecimalString({ currency, minorUnits }: Money): string {
  assertWholeMinorUnits(currency, minorUnits);
  const units = Math.floor(minorUnits / MINOR_UNITS_PER_UNIT);
  const cents = String(minorUnits % MINOR_UNITS_PER_UNIT).padStart(2, '0');
  return `${units}.${cents}`;
}

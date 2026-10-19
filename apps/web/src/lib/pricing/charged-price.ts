import { type Currency, type Money, money } from './money';
import { isPriceRegion, type PriceRegion, regionCurrency } from './regions';

// A price actually charged, such as a membership's price each period (and an order's amount from
// Phase 14b): the price region it was set for and the amount in that region's currency. It is
// stored as three columns, region, currency and amount_minor_units, and read and written only
// through this pair, so a stored price always names a price region and that region's currency.

export type ChargedPrice = { readonly region: PriceRegion; readonly amount: Money };

/** How a charged price is stored. */
export type ChargedPriceColumns = {
  region: PriceRegion;
  currency: Currency;
  amountMinorUnits: number;
};

/** The amount, if `currency` is the region's and `minorUnits` is a whole, non-negative number. */
function amountIn(region: PriceRegion, currency: string, minorUnits: number): Money {
  const expected = regionCurrency(region);
  if (currency !== expected) {
    throw new RangeError(`Expected ${expected} for ${region} but got "${currency}".`);
  }
  return money(expected, minorUnits);
}

/**
 * A charged price from its stored columns. Throws a RangeError unless the region is a price
 * region, the currency is that region's and the amount is whole minor units.
 */
export function chargedPrice(columns: {
  region: string;
  currency: string;
  amountMinorUnits: number;
}): ChargedPrice {
  const { region } = columns;
  if (!isPriceRegion(region)) throw new RangeError(`Expected a price region but got "${region}".`);
  return { region, amount: amountIn(region, columns.currency, columns.amountMinorUnits) };
}

/** The columns that store a charged price; every write goes through this. */
export function chargedPriceColumns({ region, amount }: ChargedPrice): ChargedPriceColumns {
  const checked = amountIn(region, amount.currency, amount.minorUnits);
  return { region, currency: checked.currency, amountMinorUnits: checked.minorUnits };
}

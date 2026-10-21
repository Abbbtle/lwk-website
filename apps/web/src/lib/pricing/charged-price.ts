import { type Currency, isCurrency, type Money, money } from './money';
import { isPriceRegion, type PriceRegion, regionCurrency } from './regions';

// A price actually charged, such as a membership's price each period (and an order's amount from
// Phase 14b): the price region it was set for and the amount, in minor units of a currency. It is
// stored as three columns, region, currency and amount_minor_units, and read and written only
// through this pair. Writes use the region's currency of the day; reads accept any currency the
// site knows, so a price charged before a region's currency changed still reads as it was charged.

export type ChargedPrice = { readonly region: PriceRegion; readonly amount: Money };

/** How a charged price is stored. */
export type ChargedPriceColumns = {
  region: PriceRegion;
  currency: Currency;
  amountMinorUnits: number;
};

/**
 * A charged price from its stored columns. Throws a RangeError unless the region is a price
 * region, the currency is one the site knows and the amount is whole minor units.
 */
export function chargedPrice(columns: {
  region: string;
  currency: string;
  amountMinorUnits: number;
}): ChargedPrice {
  const { region, currency } = columns;
  if (!isPriceRegion(region)) throw new RangeError(`Expected a price region but got "${region}".`);
  if (!isCurrency(currency)) throw new RangeError(`Expected a currency but got "${currency}".`);
  return { region, amount: money(currency, columns.amountMinorUnits) };
}

/**
 * The columns that store a charged price; every write goes through this. Throws a RangeError
 * unless the amount is in the region's currency today and in whole minor units.
 */
export function chargedPriceColumns({ region, amount }: ChargedPrice): ChargedPriceColumns {
  const expected = regionCurrency(region);
  if (amount.currency !== expected) {
    throw new RangeError(`Expected ${expected} for ${region} but got "${amount.currency}".`);
  }
  const checked = money(expected, amount.minorUnits);
  return { region, currency: checked.currency, amountMinorUnits: checked.minorUnits };
}

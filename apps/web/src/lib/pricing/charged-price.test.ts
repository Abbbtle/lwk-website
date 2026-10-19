import { describe, expect, it } from 'vitest';
import { chargedPrice, chargedPriceColumns } from './charged-price';
import { money } from './money';
import { membershipLeadPrice } from './prices';
import { PRICE_REGIONS, regionCurrency } from './regions';

describe('charged prices', () => {
  it('store a price from the price list as its region, currency and minor units', () => {
    expect(
      chargedPriceColumns({
        region: 'south-africa',
        amount: membershipLeadPrice('south-africa').amount,
      }),
    ).toEqual({ region: 'south-africa', currency: 'ZAR', amountMinorUnits: 9900 });
  });

  it('read back what they store, in every region', () => {
    for (const region of PRICE_REGIONS) {
      const price = { region, amount: money(regionCurrency(region), 129900) };
      expect(chargedPrice(chargedPriceColumns(price)), region).toEqual(price);
    }
  });

  it('refuse an unknown region, another currency and part of a minor unit', () => {
    expect(() =>
      chargedPrice({ region: 'atlantis', currency: 'USD', amountMinorUnits: 100 }),
    ).toThrow(new RangeError('Expected a price region but got "atlantis".'));
    expect(() => chargedPrice({ region: 'india', currency: 'USD', amountMinorUnits: 100 })).toThrow(
      new RangeError('Expected INR for india but got "USD".'),
    );
    expect(() =>
      chargedPrice({ region: 'south-africa', currency: 'ZAR', amountMinorUnits: 99.5 }),
    ).toThrow(RangeError);
    expect(() => chargedPriceColumns({ region: 'india', amount: money('USD', 100) })).toThrow(
      RangeError,
    );
  });
});

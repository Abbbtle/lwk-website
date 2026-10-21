import type { CountryCode } from '@/lib/country-code';
import type { Currency } from './money';

// Prices follow local incomes, so people everywhere can afford them: each visitor's country falls
// in one of four price regions, and each region has its own prices and currency.

export const PRICE_REGIONS = ['south-africa', 'high-income', 'india', 'rest-of-world'] as const;
export type PriceRegion = (typeof PRICE_REGIONS)[number];

/** The home market, whose prices show when a visitor's country is unknown (and locally). */
export const HOME_PRICE_REGION: PriceRegion = 'south-africa';

const regions: Record<
  PriceRegion,
  { currency: Currency; name: string; visitorPhrase: string; taxNote: string }
> = {
  'south-africa': {
    currency: 'ZAR',
    name: 'South Africa',
    visitorPhrase: 'South Africa',
    taxNote: 'including VAT',
  },
  'high-income': {
    currency: 'USD',
    name: 'The US, UK, Europe and similar countries',
    visitorPhrase: 'the US, UK, Europe and similar countries',
    taxNote: 'including local taxes',
  },
  india: { currency: 'INR', name: 'India', visitorPhrase: 'India', taxNote: 'including GST' },
  'rest-of-world': {
    currency: 'USD',
    name: 'Rest of the world',
    visitorPhrase: 'your region',
    taxNote: 'including local taxes',
  },
};

// World Bank high-income economies, classification of 1 July 2026 (ISO 3166-1 alpha-2 codes). The
// World Bank reviews the classification every July; check this list against it then.
const HIGH_INCOME_COUNTRIES = new Set(
  'AS AD AG AW AU AT BS BH BB BE BM VG BN BG CA KY JE GG CL CR HR CW CY CZ DK EE FO FI FR PF DE GI GR GL GU GY HK HU IS IE IM IL IT JP KR KW LV LI LT LU MO MT MC NR NL NC NZ MP NO OM PW PA PL PT PR QA RO RU SM SA SC SG SX SK SI ES KN MF SE CH TW TT TC AE GB US UY VI'.split(
    ' ',
  ),
);

export function isPriceRegion(value: unknown): value is PriceRegion {
  return PRICE_REGIONS.some((region) => region === value);
}

/** The price region a country belongs to. Every country belongs to one. */
export function regionForCountry(country: CountryCode): PriceRegion {
  if (country === 'ZA') return 'south-africa';
  if (country === 'IN') return 'india';
  return HIGH_INCOME_COUNTRIES.has(country) ? 'high-income' : 'rest-of-world';
}

export function regionCurrency(region: PriceRegion): Currency {
  return regions[region].currency;
}

/** The region's name in a list of every region: "South Africa", "Rest of the world". */
export function regionName(region: PriceRegion): string {
  return regions[region].name;
}

/** The region as told to a visitor there, mid-sentence: "Prices for your region". */
export function visitorRegionPhrase(region: PriceRegion): string {
  return regions[region].visitorPhrase;
}

/** Prices include tax; how to say so for the region: "including VAT". */
export function regionTaxNote(region: PriceRegion): string {
  return regions[region].taxNote;
}

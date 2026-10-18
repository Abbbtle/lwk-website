import 'server-only';
import { type CountryCode, toCountryCode } from '@/lib/country-code';
import { HOME_PRICE_REGION, type PriceRegion, regionForCountry } from '@/lib/pricing';
import { viewerCountry } from './request-info';

/**
 * Whose prices this request's visitor sees: the region of the country CloudFront reports, or the
 * home region when the country is unknown. Pages read it once and pass it down.
 */
export async function viewerPriceRegion(): Promise<PriceRegion> {
  const country = standInCountry(process.env) ?? (await viewerCountry());
  return country ? regionForCountry(country) : HOME_PRICE_REGION;
}

/**
 * Outside production, PRICE_COUNTRY (a country code such as "IN") stands in for the visitor's
 * country, so other regions' prices can be tried locally. Production ignores it.
 */
export function standInCountry(env: {
  NODE_ENV?: string;
  PRICE_COUNTRY?: string;
}): CountryCode | null {
  return env.NODE_ENV === 'production' ? null : toCountryCode(env.PRICE_COUNTRY);
}

import 'server-only';
import { type PriceRegion, regionForCountry } from '@/lib/pricing';
import { viewerCountry } from './request-info';

/**
 * Whose prices this request's visitor sees, from the country CloudFront reports. Pages read it
 * once and pass it down; prices are for display only until paid plans open.
 */
export async function viewerPriceRegion(): Promise<PriceRegion> {
  return regionForCountry(await viewerCountry());
}

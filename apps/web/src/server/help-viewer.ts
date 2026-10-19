import 'server-only';
import type { HelpViewer } from '@/lib/help';
import { hasRole, type Session } from './auth/session';
import { currentSalesMoment } from './early-access';

/**
 * The help centre as this request reads it: support staff and admins also see staff articles, and
 * passages about early access and paid plans follow the sales moment.
 */
export function helpViewer(session: Session | null): HelpViewer {
  return { staff: Boolean(session && hasRole(session, 'support')), moment: currentSalesMoment() };
}

import 'server-only';
import type { CognitoClientConfig } from '@/lib/auth-client';
import { getAuthConfig } from './config';

/** Public identifiers the sign-in pages need in the browser (not secrets). */
export function getCognitoClientConfig(): CognitoClientConfig {
  const { userPoolId, clientId } = getAuthConfig();
  return { userPoolId, clientId };
}

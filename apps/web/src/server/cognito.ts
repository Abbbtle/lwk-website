import 'server-only';
import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAuthConfig } from './auth/config';
import type { Role } from './auth/session';

let client: CognitoIdentityProviderClient | undefined;

function getClient() {
  // Credentials come from the default chain: the `lwk` profile locally, the instance role in AWS.
  client ??= new CognitoIdentityProviderClient({
    region: getAuthConfig().userPoolId.split('_')[0],
  });
  return client;
}

/** Grant a role. It appears in the user's tokens from their next refresh (within 15 minutes). */
export async function addUserToGroup(userId: string, role: Role) {
  await getClient().send(
    new AdminAddUserToGroupCommand({
      UserPoolId: getAuthConfig().userPoolId,
      // Email sign-in pools use the user's `sub` as the username.
      Username: userId,
      GroupName: role,
    }),
  );
}

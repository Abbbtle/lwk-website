import 'server-only';
import {
  AdminAddUserToGroupCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  DeleteUserCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ListUsersInGroupCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAuthConfig } from './auth/config';
import { ROLES, type Role } from './auth/session';

let client: CognitoIdentityProviderClient | undefined;

function getClient() {
  // Credentials come from the default chain: the `lwk` profile locally, the instance role in AWS.
  client ??= new CognitoIdentityProviderClient({
    region: getAuthConfig().userPoolId.split('_')[0],
  });
  return client;
}

// Admin operations act on another user and need the app's AWS credentials. Email sign-in pools
// use the user's `sub` as the username.
const target = (userId: string) => ({ UserPoolId: getAuthConfig().userPoolId, Username: userId });

/** Grant a role. Tokens carry it from the next refresh; the app applies it at once. */
export async function addUserToGroup(userId: string, role: Role) {
  await getClient().send(new AdminAddUserToGroupCommand({ ...target(userId), GroupName: role }));
}

export async function removeUserFromGroup(userId: string, role: Role) {
  await getClient().send(
    new AdminRemoveUserFromGroupCommand({ ...target(userId), GroupName: role }),
  );
}

/** The user's current roles in Cognito (the source of truth for group membership). */
export async function listUserRoles(userId: string): Promise<Role[]> {
  const { Groups = [] } = await getClient().send(
    new AdminListGroupsForUserCommand({ ...target(userId), Limit: 60 }),
  );
  const names = Groups.map((g) => g.GroupName);
  return ROLES.filter((role) => names.includes(role));
}

/** IDs of the enabled members of a role. */
export async function listRoleMembers(role: Role): Promise<string[]> {
  const ids: string[] = [];
  let NextToken: string | undefined;
  do {
    const page = await getClient().send(
      new ListUsersInGroupCommand({
        UserPoolId: getAuthConfig().userPoolId,
        GroupName: role,
        Limit: 60,
        NextToken,
      }),
    );
    for (const user of page.Users ?? []) {
      const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value ?? user.Username;
      if (user.Enabled && sub) ids.push(sub);
    }
    NextToken = page.NextToken;
  } while (NextToken);
  return ids;
}

export type CognitoAccount = {
  enabled: boolean;
  /** CONFIRMED, UNCONFIRMED, RESET_REQUIRED, FORCE_CHANGE_PASSWORD, ... */
  status: string;
  mfaEnabled: boolean;
  createdAt: Date | null;
};

export async function getAccount(userId: string): Promise<CognitoAccount | null> {
  try {
    const user = await getClient().send(new AdminGetUserCommand(target(userId)));
    return {
      enabled: user.Enabled ?? false,
      status: user.UserStatus ?? 'UNKNOWN',
      mfaEnabled: (user.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA'),
      createdAt: user.UserCreateDate ?? null,
    };
  } catch (error) {
    if ((error as { name?: string }).name === 'UserNotFoundException') return null;
    throw error;
  }
}

/** Stop the account signing in and end all of its sessions. */
export async function disableAccount(userId: string) {
  await getClient().send(new AdminDisableUserCommand(target(userId)));
  await signOutEverywhere(userId);
}

export async function enableAccount(userId: string) {
  await getClient().send(new AdminEnableUserCommand(target(userId)));
}

/** Revoke every refresh token of the user (all devices). */
export async function signOutEverywhere(userId: string) {
  await getClient().send(new AdminUserGlobalSignOutCommand(target(userId)));
}

/** Turn off a user's authenticator-app verification, e.g. after they lost their phone. */
export async function resetTwoStepVerification(userId: string) {
  await getClient().send(
    new AdminSetUserMFAPreferenceCommand({
      ...target(userId),
      SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
    }),
  );
}

// Self-service operations use the user's own access token, so they need no AWS credentials and
// can only ever affect that user.

/**
 * End every session of the signed-in user (all devices). Uses the user's own access token, so
 * no AWS credentials are involved; Cognito invalidates all of the user's refresh tokens.
 */
export async function globalSignOut(accessToken: string) {
  await getClient().send(new GlobalSignOutCommand({ AccessToken: accessToken }));
}

/** Whether the signed-in user has authenticator-app verification turned on. */
export async function getOwnMfaEnabled(accessToken: string): Promise<boolean> {
  const user = await getClient().send(new GetUserCommand({ AccessToken: accessToken }));
  return (user.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA');
}

export async function updateOwnName(accessToken: string, name: string) {
  await getClient().send(
    new UpdateUserAttributesCommand({
      AccessToken: accessToken,
      UserAttributes: [{ Name: 'name', Value: name }],
    }),
  );
}

export async function deleteOwnAccount(accessToken: string) {
  await getClient().send(new DeleteUserCommand({ AccessToken: accessToken }));
}

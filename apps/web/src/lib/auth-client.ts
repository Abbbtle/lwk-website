'use client';

// Browser-side Cognito calls for the custom sign-in pages. Passwords are verified with SRP,
// so they never leave the browser (not even to our server). Tokens are kept in memory only
// and handed to /auth/session, which stores them in HttpOnly cookies.
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
  type ICognitoStorage,
} from 'amazon-cognito-identity-js';

export type CognitoClientConfig = { userPoolId: string; clientId: string };

class MemoryStorage implements ICognitoStorage {
  private items = new Map<string, string>();
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}

function pool({ userPoolId, clientId }: CognitoClientConfig) {
  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
    Storage: new MemoryStorage(),
  });
}

function user(config: CognitoClientConfig, email: string) {
  const userPool = pool(config);
  return new CognitoUser({
    Username: email.trim().toLowerCase(),
    Pool: userPool,
    Storage: new MemoryStorage(),
  });
}

/** Human-friendly messages for Cognito error codes. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string; name?: string })?.code ?? (error as Error)?.name;
  switch (code) {
    case 'NotAuthorizedException': {
      const message = (error as Error).message ?? '';
      if (message.includes('attempts exceeded')) {
        return 'Too many attempts. Please wait a few minutes and try again.';
      }
      if (message.includes('disabled')) {
        return 'This account has been disabled. Please contact support if you think this is a mistake.';
      }
      return 'Incorrect email or password.';
    }
    case 'UserNotFoundException':
      return 'Incorrect email or password.';
    case 'UsernameExistsException':
      return 'An account with this email already exists. Log in instead.';
    case 'InvalidPasswordException':
      return 'Choose a password of at least 12 characters with upper and lower case letters and a number.';
    case 'CodeMismatchException':
    case 'EnableSoftwareTokenMFAException':
      return 'That code is not correct. Please check it and try again.';
    case 'ExpiredCodeException':
      return 'That code has expired. Request a new one.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'InvalidParameterException':
      return 'Please check the details you entered.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export type Tokens = { accessToken: string; idToken: string; refreshToken: string };

const tokensOf = (session: CognitoUserSession): Tokens => ({
  accessToken: session.getAccessToken().getJwtToken(),
  idToken: session.getIdToken().getJwtToken(),
  refreshToken: session.getRefreshToken().getToken(),
});

export type SignInResult =
  | { kind: 'signed-in'; tokens: Tokens }
  | { kind: 'mfa'; submit: (code: string) => Promise<SignInResult> }
  | { kind: 'new-password'; submit: (password: string) => Promise<SignInResult> }
  | { kind: 'unconfirmed' };

export function signIn(config: CognitoClientConfig, email: string, password: string) {
  const cognitoUser = user(config, email);
  return new Promise<SignInResult>((resolve, reject) => {
    const callbacks = (done: (r: SignInResult) => void, fail: (e: unknown) => void) => ({
      onSuccess: (session: CognitoUserSession) =>
        done({ kind: 'signed-in', tokens: tokensOf(session) }),
      onFailure: (error: unknown) =>
        (error as { code?: string })?.code === 'UserNotConfirmedException'
          ? done({ kind: 'unconfirmed' })
          : fail(error),
      totpRequired: () =>
        done({
          kind: 'mfa',
          submit: (code) =>
            new Promise((ok, err) =>
              cognitoUser.sendMFACode(code, callbacks(ok, err), 'SOFTWARE_TOKEN_MFA'),
            ),
        }),
      newPasswordRequired: () =>
        done({
          kind: 'new-password',
          submit: (newPassword) =>
            new Promise((ok, err) =>
              cognitoUser.completeNewPasswordChallenge(newPassword, {}, callbacks(ok, err)),
            ),
        }),
    });
    cognitoUser.authenticateUser(
      new AuthenticationDetails({ Username: email.trim().toLowerCase(), Password: password }),
      callbacks(resolve, reject),
    );
  });
}

export function signUp(config: CognitoClientConfig, name: string, email: string, password: string) {
  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() }),
    new CognitoUserAttribute({ Name: 'name', Value: name.trim() }),
  ];
  return new Promise<void>((resolve, reject) =>
    pool(config).signUp(email.trim().toLowerCase(), password, attributes, [], (error) =>
      error ? reject(error) : resolve(),
    ),
  );
}

export function confirmSignUp(config: CognitoClientConfig, email: string, code: string) {
  return new Promise<void>((resolve, reject) =>
    user(config, email).confirmRegistration(code.trim(), true, (error) =>
      error ? reject(error) : resolve(),
    ),
  );
}

export function resendCode(config: CognitoClientConfig, email: string) {
  return new Promise<void>((resolve, reject) =>
    user(config, email).resendConfirmationCode((error) => (error ? reject(error) : resolve())),
  );
}

export function startPasswordReset(config: CognitoClientConfig, email: string) {
  return new Promise<void>((resolve, reject) =>
    user(config, email).forgotPassword({
      onSuccess: () => resolve(),
      inputVerificationCode: () => resolve(),
      onFailure: reject,
    }),
  );
}

export function finishPasswordReset(
  config: CognitoClientConfig,
  email: string,
  code: string,
  password: string,
) {
  return new Promise<void>((resolve, reject) =>
    user(config, email).confirmPassword(code.trim(), password, {
      onSuccess: () => resolve(),
      onFailure: reject,
    }),
  );
}

/** Hand the tokens to the server, which verifies them and sets the session cookies. */
export async function createSession(tokens: Tokens, returnTo: string): Promise<string> {
  const response = await fetch('/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...tokens, returnTo }),
  });
  if (response.status === 429) {
    throw Object.assign(new Error('Too many sign-ins'), { code: 'TooManyRequestsException' });
  }
  if (!response.ok) throw new Error('Session could not be created');
  const { redirectTo } = (await response.json()) as { redirectTo: string };
  return redirectTo;
}

/**
 * Full page load after signing in, so every server-rendered part (header, menus) picks up the
 * new session cookies; a client-side route change would keep the signed-out header.
 */
export function goAfterSignIn(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}

// ---- Account security (re-authentication, password, two-step verification) ------------------

/**
 * Proof that the person at the keyboard knows the password (and code, with two-step on), for
 * sensitive account changes. Holds a short-lived Cognito session in memory only.
 */
export type Reauthenticated = { user: CognitoUser; accessToken: string };

export type ReauthResult =
  | { kind: 'ok'; session: Reauthenticated }
  | { kind: 'mfa'; submit: (code: string) => Promise<ReauthResult> };

export function reauthenticate(
  config: CognitoClientConfig,
  email: string,
  password: string,
): Promise<ReauthResult> {
  const cognitoUser = user(config, email);
  return new Promise<ReauthResult>((resolve, reject) => {
    const callbacks = (done: (r: ReauthResult) => void, fail: (e: unknown) => void) => ({
      onSuccess: (session: CognitoUserSession) =>
        done({
          kind: 'ok',
          session: { user: cognitoUser, accessToken: session.getAccessToken().getJwtToken() },
        }),
      onFailure: fail,
      totpRequired: () =>
        done({
          kind: 'mfa',
          submit: (code) =>
            new Promise((ok, err) =>
              cognitoUser.sendMFACode(code, callbacks(ok, err), 'SOFTWARE_TOKEN_MFA'),
            ),
        }),
      newPasswordRequired: () => fail(new Error('A new password is required. Log in again.')),
    });
    cognitoUser.authenticateUser(
      new AuthenticationDetails({ Username: email.trim().toLowerCase(), Password: password }),
      callbacks(resolve, reject),
    );
  });
}

export function changePassword(auth: Reauthenticated, oldPassword: string, newPassword: string) {
  return new Promise<void>((resolve, reject) =>
    auth.user.changePassword(oldPassword, newPassword, (error) =>
      error ? reject(error) : resolve(),
    ),
  );
}

/** Start authenticator setup; returns the shared secret to show as a QR code and as text. */
export function startTotpSetup(auth: Reauthenticated) {
  return new Promise<string>((resolve, reject) =>
    auth.user.associateSoftwareToken({
      associateSecretCode: (secret: string) => resolve(secret),
      onFailure: reject,
    }),
  );
}

/** Confirm the first code from the authenticator app and make it required at sign-in. */
export function finishTotpSetup(auth: Reauthenticated, code: string) {
  return new Promise<void>((resolve, reject) =>
    auth.user.verifySoftwareToken(code.trim(), 'Authenticator app', {
      onSuccess: () =>
        auth.user.setUserMfaPreference(null, { PreferredMfa: true, Enabled: true }, (error) =>
          error ? reject(error) : resolve(),
        ),
      onFailure: reject,
    }),
  );
}

export function turnOffTotp(auth: Reauthenticated) {
  return new Promise<void>((resolve, reject) =>
    auth.user.setUserMfaPreference(null, { PreferredMfa: false, Enabled: false }, (error) =>
      error ? reject(error) : resolve(),
    ),
  );
}

/** The otpauth:// link authenticator apps read from the QR code. */
export function totpUri(secret: string, email: string) {
  const issuer = 'Living With Krishna';
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

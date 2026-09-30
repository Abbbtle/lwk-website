import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import type { StageConfig } from './config';

export type AuthStackProps = cdk.StackProps & { stageConfig: StageConfig };

/**
 * Sign-up and sign-in for the website: a Cognito user pool with hosted sign-in pages and a
 * public app client. The Next.js server runs the authorization code + PKCE flow and keeps
 * tokens in HttpOnly cookies, so no client secret is needed.
 */
export class AuthStack extends cdk.Stack {
  readonly userPool: cognito.UserPool;
  readonly webClient: cognito.UserPoolClient;
  readonly hostedDomainUrl: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { stage, authDomainPrefix, appOrigins } = props.stageConfig;

    const userPool = (this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `lwk-${stage}-users`,
      // Essentials: managed login pages; free for the first 10,000 monthly active users.
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      keepOriginal: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        passwordHistorySize: 5,
      },
      // Optional authenticator-app MFA for learners; SMS is not offered (cost, weaker).
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Cognito's built-in email sender (low daily limit) until SES is set up.
      email: cognito.UserPoolEmail.withCognito(),
      // Used for both the sign-up code and the password reset code.
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
        emailSubject: 'Your Living With Krishna code',
        emailBody: [
          '<div style="font-family:Arial,sans-serif;font-size:16px;color:#111">',
          '<p>Hare Krishna,</p>',
          '<p>Your Living With Krishna verification code is:</p>',
          '<p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#f97316">{####}</p>',
          '<p>Enter it on the page where you signed up or asked to reset your password.',
          ' The code expires soon. If you did not request it, you can ignore this email.</p>',
          '<p>Living With Krishna</p>',
          '</div>',
        ].join(''),
      },
      deletionProtection: true,
      // The pool holds user accounts: never delete it with the stack.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    }));

    // Every signed-in user is a learner; these groups grant extra access.
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Platform administrators',
      precedence: 10,
    });
    new cognito.CfnUserPoolGroup(this, 'InstructorGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'instructor',
      description: 'Approved course instructors',
      precedence: 20,
    });

    const domain = userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: authDomainPrefix },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const webClient = (this.webClient = userPool.addClient('WebClient', {
      userPoolClientName: `lwk-${stage}-web`,
      generateSecret: false,
      // SRP only (passwords never leave the sign-in page). Setting a flow explicitly also keeps
      // ALLOW_REFRESH_TOKEN_AUTH off, which conflicts with refresh token rotation.
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: appOrigins.map((origin) => `${origin}/auth/callback`),
        logoutUrls: appOrigins.map((origin) => `${origin}/`),
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      // Each refresh returns a new refresh token and retires the old one.
      refreshTokenRotationGracePeriod: cdk.Duration.seconds(30),
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.days(30),
    }));
    this.hostedDomainUrl = `https://${authDomainPrefix}.auth.${this.region}.amazoncognito.com`;

    // Managed login needs a branding style per app client; start from Cognito's defaults.
    const branding = new cognito.CfnManagedLoginBranding(this, 'WebClientBranding', {
      userPoolId: userPool.userPoolId,
      clientId: webClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });
    branding.node.addDependency(domain);

    // Public identifiers the web app needs (none of these are secrets).
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'WebClientId', { value: webClient.userPoolClientId });
    new cdk.CfnOutput(this, 'HostedDomain', { value: this.hostedDomainUrl });
    new cdk.CfnOutput(this, 'Issuer', { value: userPool.userPoolProviderUrl });
  }
}

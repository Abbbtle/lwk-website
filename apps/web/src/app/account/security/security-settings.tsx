'use client';

import { KeyRound, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { AuthError, AuthField, PASSWORD_HINT, passwordProblem } from '@/components/auth/auth-ui';
import { QrCode } from '@/components/qr-code';
import {
  authErrorMessage,
  changePassword,
  type CognitoClientConfig,
  finishTotpSetup,
  type Reauthenticated,
  startTotpSetup,
  totpUri,
  turnOffTotp,
} from '@/lib/auth-client';
import { refreshTwoStepStatus } from '../actions';
import { ConfirmIdentity } from '../confirm-identity';

type Flow =
  | { name: 'idle' }
  | { name: 'confirm'; task: 'password' | 'totp-on' | 'totp-off' }
  | { name: 'password'; auth: Reauthenticated; oldPassword: string }
  | { name: 'totp-setup'; auth: Reauthenticated; secret: string }
  | { name: 'totp-off'; auth: Reauthenticated };

function Card({
  icon,
  title,
  status,
  children,
}: {
  icon: ReactNode;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white p-6 shadow-md sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-brand">
            {icon}
          </span>
          {title}
        </h2>
        {status}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Notice({ tone, children }: { tone: 'success' | 'warning'; children: ReactNode }) {
  const style =
    tone === 'success'
      ? 'border-green-700 bg-green-50 text-green-900'
      : 'border-brand bg-orange-50 text-gray-900';
  return (
    <div role="status" className={`border-l-4 p-4 text-sm ${style}`}>
      {children}
    </div>
  );
}

export function SecuritySettings({
  config,
  email,
  mfaEnabled,
  isStaff,
  staffRequired,
  returnTo,
}: {
  config: CognitoClientConfig;
  email: string;
  mfaEnabled: boolean;
  /** Holds the admin or support role. */
  isStaff: boolean;
  /** Arrived from a staff page that needs two-step verification first. */
  staffRequired: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>({ name: 'idle' });
  const [done, setDone] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [code, setCode] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const logoutForm = useRef<HTMLFormElement>(null);

  function reset(message: ReactNode = null) {
    setFlow({ name: 'idle' });
    setDone(message);
    setError(null);
    setPending(false);
    setNewPassword('');
    setRepeatPassword('');
    setCode('');
  }

  function start(task: 'password' | 'totp-on' | 'totp-off') {
    reset();
    setFlow({ name: 'confirm', task });
  }

  async function confirmed(
    task: 'password' | 'totp-on' | 'totp-off',
    auth: Reauthenticated,
    password: string,
  ) {
    setError(null);
    if (task === 'password') return setFlow({ name: 'password', auth, oldPassword: password });
    if (task === 'totp-off') return setFlow({ name: 'totp-off', auth });
    try {
      setFlow({ name: 'totp-setup', auth, secret: await startTotpSetup(auth) });
    } catch (err) {
      reset();
      setError(authErrorMessage(err));
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (flow.name !== 'password') return;
    setError(null);
    const problem = passwordProblem(newPassword);
    if (problem) return setError(problem);
    if (newPassword !== repeatPassword) return setError('The two passwords do not match.');
    if (newPassword === flow.oldPassword)
      return setError('Choose a password you have not used here.');
    setPending(true);
    try {
      await changePassword(flow.auth, flow.oldPassword, newPassword);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
      return;
    }
    if (signOutOthers) {
      // Ends every session, this one included; they log in again with the new password.
      logoutForm.current?.requestSubmit();
      return;
    }
    reset('Your password has been changed.');
  }

  async function turnOn(event: FormEvent) {
    event.preventDefault();
    if (flow.name !== 'totp-setup') return;
    setError(null);
    if (code.trim().length !== 6) return setError('Enter the 6-digit code from your app.');
    setPending(true);
    try {
      await finishTotpSetup(flow.auth, code);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
      return;
    }
    await refreshTwoStepStatus();
    router.refresh();
    reset(
      <>
        Two-step verification is on. We will ask for a code from your authenticator app each time
        you log in.
        {staffRequired && (
          <>
            {' '}
            <Link href={returnTo} className="font-semibold underline">
              Continue where you were going
            </Link>
          </>
        )}
      </>,
    );
  }

  async function turnOff() {
    if (flow.name !== 'totp-off') return;
    setPending(true);
    try {
      await turnOffTotp(flow.auth);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
      return;
    }
    await refreshTwoStepStatus();
    router.refresh();
    reset('Two-step verification is off.');
  }

  const confirming = (task: 'password' | 'totp-on' | 'totp-off', purpose: string) =>
    flow.name === 'confirm' &&
    flow.task === task && (
      <ConfirmIdentity
        config={config}
        email={email}
        purpose={purpose}
        onConfirmed={(auth, password) => confirmed(task, auth, password)}
        onCancel={() => reset()}
      />
    );

  return (
    <div className="space-y-8">
      {staffRequired && !mfaEnabled && (
        <Notice tone="warning">
          <strong>Admin and support tools need two-step verification.</strong> Staff accounts can
          see and change other people&apos;s accounts and messages, so they must be protected by a
          code from an authenticator app as well as a password. Turn it on below; it takes about two
          minutes.
        </Notice>
      )}
      {done && <Notice tone="success">{done}</Notice>}
      <AuthError message={flow.name === 'idle' ? error : null} />

      <Card
        icon={<Smartphone className="size-5" aria-hidden />}
        title="Two-step verification"
        status={
          <span
            className={`border px-2 py-0.5 text-xs font-bold uppercase ${
              mfaEnabled ? 'border-green-700 text-green-800' : 'border-gray-400 text-gray-700'
            }`}
          >
            {mfaEnabled ? 'On' : 'Off'}
          </span>
        }
      >
        <p className="text-gray-700">
          {mfaEnabled
            ? 'When you log in, we ask for your password and a code from your authenticator app.'
            : 'Protect your account with a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password) as well as your password.'}
          {isStaff && ' Required for admin and support accounts.'}
        </p>

        {flow.name === 'idle' &&
          (mfaEnabled ? (
            <button type="button" className="btn-outline" onClick={() => start('totp-off')}>
              Turn off
            </button>
          ) : (
            <button type="button" className="btn-solid" onClick={() => start('totp-on')}>
              Turn on two-step verification
            </button>
          ))}

        {confirming('totp-on', 'set up two-step verification')}
        {confirming('totp-off', 'turn off two-step verification')}

        {flow.name === 'totp-setup' && (
          <form
            onSubmit={turnOn}
            noValidate
            className="space-y-5 border border-gray-300 bg-surface p-5"
          >
            <h3 className="font-bold">Set up your authenticator app</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Open your authenticator app and add a new account.</li>
              <li>Scan this QR code, or type in the key below.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-6">
              <QrCode
                value={totpUri(flow.secret, email)}
                label="QR code for your authenticator app"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-gray-600">Setup key</p>
                <p className="font-mono text-sm font-semibold break-all">
                  {flow.secret.match(/.{1,4}/g)?.join(' ')}
                </p>
              </div>
            </div>
            <AuthError message={error} />
            <AuthField
              label="Code from the app"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
                {pending ? 'Checking...' : 'Turn on'}
              </button>
              <button type="button" onClick={() => reset()} className="btn-outline">
                Cancel
              </button>
            </div>
          </form>
        )}

        {flow.name === 'totp-off' && (
          <div className="space-y-4 border border-gray-300 bg-surface p-5">
            <h3 className="font-bold">Turn off two-step verification?</h3>
            <p className="text-sm text-gray-700">
              Anyone who learns your password will be able to log in as you.
              {isStaff && ' Admin and support tools will be locked until you turn it on again.'}
            </p>
            <AuthError message={error} />
            <div className="flex flex-wrap gap-3">
              <button type="button" autoFocus onClick={() => reset()} className="btn-outline">
                Keep it on
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={turnOff}
                className="btn-solid disabled:opacity-60"
              >
                {pending ? 'Turning off...' : 'Turn off'}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card icon={<KeyRound className="size-5" aria-hidden />} title="Password">
        <p className="text-gray-700">
          Use a long password you do not use anywhere else. {PASSWORD_HINT}
        </p>
        {flow.name === 'idle' && (
          <button type="button" className="btn-outline" onClick={() => start('password')}>
            Change password
          </button>
        )}
        {confirming('password', 'change your password')}
        {flow.name === 'password' && (
          <form
            onSubmit={savePassword}
            noValidate
            className="space-y-5 border border-gray-300 bg-surface p-5"
          >
            <h3 className="font-bold">Choose a new password</h3>
            <AuthError message={error} />
            <AuthField
              label="New password"
              type="password"
              autoComplete="new-password"
              hint={PASSWORD_HINT}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <AuthField
              label="Repeat new password"
              type="password"
              autoComplete="new-password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={signOutOthers}
                onChange={(e) => setSignOutOthers(e.target.checked)}
                className="mt-0.5 size-4 accent-black"
              />
              <span>
                Log out everywhere afterwards
                <span className="block text-xs text-gray-500">
                  Recommended if you think someone else knows your old password. You will log in
                  again with the new one.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={pending} className="btn-solid disabled:opacity-60">
                {pending ? 'Saving...' : 'Change password'}
              </button>
              <button type="button" onClick={() => reset()} className="btn-outline">
                Cancel
              </button>
            </div>
          </form>
        )}
      </Card>

      <Card icon={<LogOut className="size-5" aria-hidden />} title="Where you're logged in">
        <p className="text-gray-700">
          Lost a phone or used a shared computer? Log out of Living With Krishna on every device,
          including this one.
        </p>
        <form ref={logoutForm} action="/auth/logout" method="post" className="space-y-4">
          <input type="hidden" name="everywhere" value="1" />
          {confirmSignOut ? (
            <div className="space-y-4 border border-gray-300 bg-surface p-5">
              <p className="font-semibold">Log out on all devices now?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmSignOut(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-solid">
                  Log out everywhere
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className="btn-outline"
              onClick={(event) => {
                // With JavaScript, ask first; without it the form simply submits.
                event.preventDefault();
                setConfirmSignOut(true);
              }}
            >
              Log out everywhere
            </button>
          )}
        </form>
      </Card>

      <p className="flex items-start gap-2 text-sm text-gray-600">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        We never see your password: it is checked by our sign-in service in your browser, and we
        will never ask for it by email or phone.
      </p>
    </div>
  );
}

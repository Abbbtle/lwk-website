import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { getCognitoClientConfig } from '@/server/auth/client-config';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm config={getCognitoClientConfig()} />;
}

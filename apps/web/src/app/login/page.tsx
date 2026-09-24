import type { Metadata } from 'next';
import { AccountsComingSoon } from '@/components/accounts-coming-soon';

export const metadata: Metadata = { title: 'Log In' };

export default function LoginPage() {
  return <AccountsComingSoon title="Welcome to LWK" />;
}

import type { Metadata } from 'next';
import { AccountsComingSoon } from '@/components/accounts-coming-soon';

export const metadata: Metadata = { title: 'Sign Up' };

export default function SignUpPage() {
  return <AccountsComingSoon title="Join LWK" />;
}

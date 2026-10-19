import 'server-only';

// Payment settings come from the environment (Parameter Store /lwk/<stage>/web/* in AWS), so
// checkout can be switched off without a code release.

export type PaymentsConfig = {
  /**
   * Whether checkout is open, off by default: a switch for taking payments, not for access. Who
   * may open a course follows early access and what people hold (src/server/access.ts), so turning
   * this off never reopens a paid course.
   */
  readonly enabled: boolean;
};

export function paymentsConfig(): PaymentsConfig {
  return { enabled: process.env.PAYMENTS_ENABLED === 'true' };
}

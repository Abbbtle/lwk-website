import 'server-only';

// Payment settings come from the environment (Parameter Store /lwk/<stage>/web/* in AWS), so paid
// plans can open without a code release.

export type PaymentsConfig = {
  /**
   * Master switch, off by default. While it is off, every course is open to everyone signed in
   * (early access), and joining a course that is not free earns an early-access grant.
   */
  readonly enabled: boolean;
  /** Days a membership whose renewal failed (past due) still opens courses. */
  readonly pastDueGraceDays: number;
};

export function paymentsConfig(): PaymentsConfig {
  return {
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    pastDueGraceDays: 3,
  };
}

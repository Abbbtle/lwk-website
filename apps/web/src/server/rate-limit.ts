import 'server-only';
import { getDb } from './db';

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Limits for actions anyone can trigger. Keys are per IP or per user. */
export const RATE_LIMITS = {
  // Sign-in completions per IP (failed passwords are limited by Cognito itself).
  session: { limit: 30, windowSeconds: 10 * 60 },
  contact: { limit: 5, windowSeconds: 60 * 60 },
  instructorApplication: { limit: 5, windowSeconds: 24 * 60 * 60 },
  profile: { limit: 20, windowSeconds: 60 * 60 },
  dataExport: { limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Count one attempt against `key` in a fixed window. Stored in PostgreSQL, so limits hold across
 * restarts and more than one server. Times are UTC, like every timestamp Prisma writes (the
 * columns have no time zone, so `now()` alone would follow the session's time zone).
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const [row] = await getDb().$queryRaw<{ count: number; reset_at: Date }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, (now() AT TIME ZONE 'utc') + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'utc') THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'utc')
        THEN (now() AT TIME ZONE 'utc') + make_interval(secs => ${rule.windowSeconds})
        ELSE rate_limits.reset_at END
    RETURNING count, reset_at`;

  // Occasionally clear out expired windows so the table stays small.
  if (Math.random() < 0.01) {
    void getDb()
      .$executeRaw`DELETE FROM rate_limits WHERE reset_at < (now() AT TIME ZONE 'utc') - interval '1 day'`.catch(
      () => {},
    );
  }

  const count = Number(row.count);
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((row.reset_at.getTime() - Date.now()) / 1000)),
  };
}

/** "Try again in 12 minutes" style wording for a retry delay. */
export function retryMessage(seconds: number): string {
  if (seconds < 90) return 'Please wait a minute and try again.';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `Please try again in ${minutes} minutes.`;
  return `Please try again in ${Math.ceil(minutes / 60)} hours.`;
}

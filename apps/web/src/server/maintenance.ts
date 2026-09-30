import 'server-only';
import { getDb } from './db';

// Routine clean-up of data that is only useful for a while. Runs at most once an hour, started by
// the health check (called every few minutes by the uptime monitor), and never blocks it.

const HOUR = 60 * 60 * 1000;
let lastRun = 0;

export function scheduleMaintenance() {
  if (Date.now() - lastRun < HOUR) return;
  lastRun = Date.now();
  void runMaintenance().catch((error) => console.error('Maintenance failed', error));
}

export async function runMaintenance(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * 24 * HOUR);
  const db = getDb();
  const [limits, notifications, usage, feedback, aiFeedback] = await db.$transaction([
    db.rateLimit.deleteMany({ where: { resetAt: { lt: ago(1) } } }),
    db.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: ago(90) } } }),
    // Kept a little over a year for month-by-month comparisons.
    db.aiUsage.deleteMany({ where: { createdAt: { lt: ago(400) } } }),
    db.helpFeedback.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
    db.aiFeedback.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
  ]);
  return {
    rateLimits: limits.count,
    notifications: notifications.count,
    aiUsage: usage.count,
    helpFeedback: feedback.count,
    aiFeedback: aiFeedback.count,
  };
}

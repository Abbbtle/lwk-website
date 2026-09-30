import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { runMaintenance } from './maintenance';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('maintenance', () => {
  it('removes old read notifications and expired limits, keeping recent and unread ones', async () => {
    const user = await getDb().user.create({
      data: {
        id: randomUUID(),
        email: `${randomUUID()}@example.org`,
        name: 'M',
        lastSignInAt: new Date(),
      },
    });
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await getDb().notification.createMany({
      data: [
        { userId: user.id, kind: 't', title: 'old and read', readAt: old, createdAt: old },
        { userId: user.id, kind: 't', title: 'old but unread', createdAt: old },
        { userId: user.id, kind: 't', title: 'recent and read', readAt: new Date() },
      ],
    });
    await getDb().rateLimit.create({ data: { key: `m:${randomUUID()}`, count: 1, resetAt: old } });

    const removed = await runMaintenance();
    expect(removed.notifications).toBe(1);
    expect(removed.rateLimits).toBeGreaterThanOrEqual(1);
    const left = await getDb().notification.findMany({ where: { userId: user.id } });
    expect(left.map((n) => n.title).sort()).toEqual(['old but unread', 'recent and read']);
  });
});

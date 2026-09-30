import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { rateLimit, retryMessage } from './rate-limit';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('rateLimit', () => {
  it('allows up to the limit in a window, then refuses', async () => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, rule));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('counts each key separately', async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    expect((await rateLimit(`test:${randomUUID()}`, rule)).ok).toBe(true);
    expect((await rateLimit(`test:${randomUUID()}`, rule)).ok).toBe(true);
  });

  it('starts a new window once the old one has passed', async () => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 1, windowSeconds: 60 };
    await rateLimit(key, rule);
    expect((await rateLimit(key, rule)).ok).toBe(false);
    await getDb().rateLimit.update({
      where: { key },
      data: { resetAt: new Date(Date.now() - 1000) },
    });
    expect(await rateLimit(key, rule)).toMatchObject({ ok: true, remaining: 0 });
  });
});

describe('retryMessage', () => {
  it('rounds to a friendly unit', () => {
    expect(retryMessage(30)).toBe('Please wait a minute and try again.');
    expect(retryMessage(600)).toBe('Please try again in 10 minutes.');
    expect(retryMessage(3 * 3600)).toBe('Please try again in 3 hours.');
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { listAuditEvents, recordAudit } from './audit';
import { getDb } from './db';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('audit log', () => {
  it('records events and lists them newest first, filtered and paged', async () => {
    const targetId = randomUUID();
    for (let i = 0; i < 55; i++) {
      await recordAudit('system', {
        action: i % 2 ? 'test.odd' : 'test.even',
        target: { type: 'test', id: targetId },
        summary: `Event ${i}`,
      });
    }
    const first = await listAuditEvents({ targetType: 'test', targetId });
    expect(first.events).toHaveLength(50);
    expect(first.events[0].summary).toBe('Event 54');
    expect(first.nextCursor).not.toBeNull();

    const second = await listAuditEvents({
      targetType: 'test',
      targetId,
      before: first.nextCursor!,
    });
    expect(second.events.map((e) => e.summary)).toEqual([
      'Event 4',
      'Event 3',
      'Event 2',
      'Event 1',
      'Event 0',
    ]);
    expect(second.nextCursor).toBeNull();

    const odd = await listAuditEvents({ targetType: 'test', targetId, action: 'test.odd' });
    expect(odd.events.every((e) => e.action === 'test.odd')).toBe(true);
  });

  it('never throws, even if the entry cannot be stored', async () => {
    await expect(
      recordAudit(
        { userId: 'not-a-uuid', name: 'Broken' },
        {
          action: 'test.broken',
          target: { type: 'test' },
          summary: 'Invalid actor ID',
        },
      ),
    ).resolves.toBeUndefined();
  });
});

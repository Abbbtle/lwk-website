import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from './db';

export type AuditActor = { userId: string; name: string } | 'system';

export type AuditEntry = {
  action: string;
  target: { type: string; id?: string };
  summary: string;
  details?: Prisma.InputJsonValue;
  ip?: string;
};

/**
 * Record a security-relevant action. Failures are logged but never block the action itself,
 * which has already happened by the time it is recorded.
 */
export async function recordAudit(actor: AuditActor, entry: AuditEntry) {
  try {
    await getDb().auditEvent.create({
      data: {
        actorId: actor === 'system' ? null : actor.userId,
        actorName: actor === 'system' ? 'System' : actor.name,
        action: entry.action,
        targetType: entry.target.type,
        targetId: entry.target.id ?? null,
        summary: entry.summary,
        details: entry.details,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error('Audit record failed', entry.action, error);
  }
}

const PAGE_SIZE = 50;

export async function listAuditEvents({
  targetType,
  targetId,
  action,
  before,
}: {
  targetType?: string;
  targetId?: string;
  action?: string;
  /** Cursor: only events older than this event ID (UUIDv7 IDs sort by time). */
  before?: string;
} = {}) {
  const events = await getDb().auditEvent.findMany({
    where: {
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      ...(action && { action: { startsWith: action } }),
      ...(before && { id: { lt: before } }),
    },
    orderBy: { id: 'desc' },
    take: PAGE_SIZE + 1,
  });
  return {
    events: events.slice(0, PAGE_SIZE),
    nextCursor: events.length > PAGE_SIZE ? events[PAGE_SIZE - 1].id : null,
  };
}

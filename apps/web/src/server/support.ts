import 'server-only';
import type {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/generated/prisma/client';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';
import { notify } from './notifications';

// Support requests: people ask in-app; admins and support staff answer. Internal notes are
// never shown to the person who asked.

export class SupportError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

export const TICKET_CATEGORIES: { value: TicketCategory; label: string; hint: string }[] = [
  {
    value: 'ACCOUNT',
    label: 'My account',
    hint: 'Logging in, two-step verification, email, deleting',
  },
  { value: 'LEARNING', label: 'Courses and learning', hint: 'Enrolling, lessons, progress' },
  { value: 'TEACHING', label: 'Teaching', hint: 'Applying, building and publishing courses' },
  {
    value: 'TECHNICAL',
    label: 'Something is not working',
    hint: 'Errors, videos or pages that fail',
  },
  { value: 'FEEDBACK', label: 'Feedback or an idea', hint: 'What could be better' },
  { value: 'OTHER', label: 'Something else', hint: '' },
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Waiting for your reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** Staff see "waiting for the person" rather than "waiting for your reply". */
export const STAFF_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Waiting for them',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const ticketRef = (number: number) => `#${number}`;
const staffHref = (number: number) => `/admin/support/${number}`;
const requesterHref = (number: number) => `/support/${number}`;

function assertStaff(session: Session) {
  if (!hasRole(session, 'support')) throw new SupportError('forbidden', 'Support staff only.');
}

// ---- The person asking ------------------------------------------------------------------------

export async function createTicket(
  session: Session,
  input: {
    category: TicketCategory;
    subject: string;
    body: string;
    pageUrl?: string;
    userAgent?: string;
  },
) {
  return getDb().supportTicket.create({
    data: {
      requesterId: session.userId,
      category: input.category,
      subject: input.subject,
      pageUrl: input.pageUrl ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      priority: input.category === 'TECHNICAL' ? 'HIGH' : 'NORMAL',
      messages: {
        create: {
          authorId: session.userId,
          authorName: session.name,
          fromStaff: false,
          body: input.body,
        },
      },
    },
  });
}

export async function listMyTickets(userId: string) {
  return getDb().supportTicket.findMany({
    where: { requesterId: userId },
    orderBy: { lastActivityAt: 'desc' },
    take: 100,
    include: { _count: { select: { messages: { where: { internal: false } } } } },
  });
}

async function myTicket(session: Session, number: number) {
  const ticket = await getDb().supportTicket.findUnique({ where: { number } });
  // The same answer whether it does not exist or is someone else's.
  if (!ticket || ticket.requesterId !== session.userId) {
    throw new SupportError('not_found', 'Support request not found.');
  }
  return ticket;
}

export async function getMyTicket(session: Session, number: number) {
  const ticket = await myTicket(session, number);
  const messages = await getDb().supportMessage.findMany({
    where: { ticketId: ticket.id, internal: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, authorName: true, fromStaff: true, body: true, createdAt: true },
  });
  return { ...ticket, messages };
}

export async function replyAsRequester(session: Session, number: number, body: string) {
  const ticket = await myTicket(session, number);
  if (ticket.status === 'CLOSED') {
    throw new SupportError('invalid', 'This request is closed. Please start a new one.');
  }
  const now = new Date();
  await getDb().$transaction([
    getDb().supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.userId,
        authorName: session.name,
        fromStaff: false,
        body,
      },
    }),
    // A reply from the person reopens the request.
    getDb().supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'OPEN', resolvedAt: null, lastActivityAt: now },
    }),
  ]);
  if (ticket.assigneeId) {
    await notify(ticket.assigneeId, {
      kind: 'support.requester_reply',
      title: `${session.name} replied to ${ticketRef(number)}`,
      body: ticket.subject,
      href: staffHref(number),
    });
  }
}

export async function setMyTicketResolved(session: Session, number: number, resolved: boolean) {
  const ticket = await myTicket(session, number);
  if (ticket.status === 'CLOSED') throw new SupportError('invalid', 'This request is closed.');
  await getDb().supportTicket.update({
    where: { id: ticket.id },
    data: resolved
      ? { status: 'RESOLVED', resolvedAt: new Date(), lastActivityAt: new Date() }
      : { status: 'OPEN', resolvedAt: null, lastActivityAt: new Date() },
  });
}

// ---- Support staff ---------------------------------------------------------------------------

export const INBOX_VIEWS = ['open', 'pending', 'mine', 'resolved', 'closed', 'all'] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

const PAGE_SIZE = 50;

export async function listTickets(
  session: Session,
  { view = 'open', query, page = 1 }: { view?: InboxView; query?: string; page?: number } = {},
) {
  assertStaff(session);
  const terms = (query ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  const number = /^#?(\d+)$/.exec(query?.trim() ?? '')?.[1];
  const where: Prisma.SupportTicketWhereInput = {
    ...(view === 'open' && { status: 'OPEN' }),
    ...(view === 'pending' && { status: 'PENDING' }),
    ...(view === 'resolved' && { status: 'RESOLVED' }),
    ...(view === 'closed' && { status: 'CLOSED' }),
    ...(view === 'mine' && { assigneeId: session.userId, status: { in: ['OPEN', 'PENDING'] } }),
    ...(number
      ? { number: Number(number) }
      : {
          AND: terms.map((term) => ({
            OR: [
              { subject: { contains: term, mode: 'insensitive' } },
              { requester: { name: { contains: term, mode: 'insensitive' } } },
              { requester: { email: { contains: term, mode: 'insensitive' } } },
            ],
          })),
        }),
  };
  const [tickets, total] = await Promise.all([
    getDb().supportTicket.findMany({
      where,
      // Urgent first, then the ones waiting longest.
      orderBy:
        view === 'open' || view === 'mine'
          ? [{ priority: 'desc' }, { lastActivityAt: 'asc' }]
          : [{ lastActivityAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
      },
    }),
    getDb().supportTicket.count({ where }),
  ]);
  return { tickets, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function countOpenTickets() {
  return getDb().supportTicket.count({ where: { status: 'OPEN' } });
}

export async function getTicketForStaff(session: Session, number: number) {
  assertStaff(session);
  const ticket = await getDb().supportTicket.findUnique({
    where: { number },
    include: {
      requester: { select: { id: true, name: true, email: true, createdAt: true, roles: true } },
      assignee: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) throw new SupportError('not_found', 'Support request not found.');
  const otherTickets = await getDb().supportTicket.count({
    where: { requesterId: ticket.requesterId, id: { not: ticket.id } },
  });
  return { ...ticket, otherTickets };
}

/** People who can be assigned requests: admins and support staff (from the stored roles). */
export async function listStaff() {
  return getDb().user.findMany({
    where: { OR: [{ roles: { has: 'admin' } }, { roles: { has: 'support' } }], disabledAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export async function replyAsStaff(
  session: Session,
  number: number,
  body: string,
  { internal = false, resolve = false }: { internal?: boolean; resolve?: boolean } = {},
) {
  assertStaff(session);
  const ticket = await getDb().supportTicket.findUnique({ where: { number } });
  if (!ticket) throw new SupportError('not_found', 'Support request not found.');
  const now = new Date();
  const status: TicketStatus | undefined = internal ? undefined : resolve ? 'RESOLVED' : 'PENDING';
  await getDb().$transaction([
    getDb().supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.userId,
        authorName: session.name,
        fromStaff: true,
        internal,
        body,
      },
    }),
    getDb().supportTicket.update({
      where: { id: ticket.id },
      data: {
        lastActivityAt: now,
        // Whoever answers first takes the request.
        ...(!ticket.assigneeId && !internal && { assigneeId: session.userId }),
        ...(status && { status, resolvedAt: status === 'RESOLVED' ? now : null }),
      },
    }),
  ]);
  if (!internal) {
    await notify(ticket.requesterId, {
      kind: 'support.reply',
      title: `Support replied to your request ${ticketRef(number)}`,
      body: ticket.subject,
      href: requesterHref(number),
    });
  }
}

export async function updateTicket(
  session: Session,
  number: number,
  changes: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null },
) {
  assertStaff(session);
  const ticket = await getDb().supportTicket.findUnique({ where: { number } });
  if (!ticket) throw new SupportError('not_found', 'Support request not found.');
  if (changes.assigneeId) {
    const staff = await listStaff();
    if (!staff.some((s) => s.id === changes.assigneeId)) {
      throw new SupportError('invalid', 'Requests can only be assigned to staff.');
    }
  }
  await getDb().supportTicket.update({
    where: { id: ticket.id },
    data: {
      ...(changes.priority && { priority: changes.priority }),
      ...(changes.assigneeId !== undefined && { assigneeId: changes.assigneeId }),
      ...(changes.status && {
        status: changes.status,
        resolvedAt: changes.status === 'RESOLVED' ? new Date() : null,
        lastActivityAt: new Date(),
      }),
    },
  });
  if (changes.status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
    await notify(ticket.requesterId, {
      kind: 'support.resolved',
      title: `Your request ${ticketRef(number)} was marked as resolved`,
      body: 'Reply if you still need help, and it opens again.',
      href: requesterHref(number),
    });
  }
  if (changes.assigneeId && changes.assigneeId !== session.userId) {
    await notify(changes.assigneeId, {
      kind: 'support.assigned',
      title: `${session.name} assigned ${ticketRef(number)} to you`,
      body: ticket.subject,
      href: staffHref(number),
    });
  }
}

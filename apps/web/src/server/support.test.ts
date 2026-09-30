import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { testSession } from '../../test/sessions';
import type { Role } from './auth/session';
import { getDb } from './db';
import { listNotifications, markRead, unreadCount } from './notifications';
import {
  createTicket,
  getMyTicket,
  getTicketForStaff,
  listMyTickets,
  listTickets,
  replyAsRequester,
  replyAsStaff,
  setMyTicketResolved,
  SupportError,
  updateTicket,
} from './support';

afterAll(async () => {
  await getDb().$disconnect();
});

async function person(roles: Role[] = [], name = 'Person') {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name,
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

const request = {
  category: 'TECHNICAL' as const,
  subject: 'Video will not play',
  body: 'The first lesson shows a black screen.',
  pageUrl: '/learn/x/y',
};

describe('support requests', () => {
  it('numbers requests from 1001 and keeps them private to the person who asked', async () => {
    const learner = await person([], 'Learner');
    const other = await person([], 'Someone Else');
    const ticket = await createTicket(learner, request);
    expect(ticket.number).toBeGreaterThanOrEqual(1001);
    expect(ticket.priority).toBe('HIGH');
    expect((await listMyTickets(learner.userId)).map((t) => t.id)).toEqual([ticket.id]);
    await expect(getMyTicket(other, ticket.number)).rejects.toBeInstanceOf(SupportError);
  });

  it('runs a full conversation with notifications, internal notes and reopening', async () => {
    const learner = await person([], 'Learner');
    const agent = await person(['support'], 'Agent');
    const ticket = await createTicket(learner, request);

    await replyAsStaff(agent, ticket.number, 'Checking internally.', { internal: true });
    expect(await unreadCount(learner.userId)).toBe(0);

    await replyAsStaff(agent, ticket.number, 'Could you tell us your browser?');
    const afterReply = await getTicketForStaff(agent, ticket.number);
    expect(afterReply).toMatchObject({ status: 'PENDING', assigneeId: agent.userId });
    const [note] = await listNotifications(learner.userId);
    expect(note).toMatchObject({ kind: 'support.reply', href: `/support/${ticket.number}` });

    // The person never sees internal notes.
    const mine = await getMyTicket(learner, ticket.number);
    expect(mine.messages.map((m) => m.body)).toEqual([
      request.body,
      'Could you tell us your browser?',
    ]);

    await replyAsRequester(learner, ticket.number, 'Chrome on a phone.');
    expect((await getTicketForStaff(agent, ticket.number)).status).toBe('OPEN');
    expect((await listNotifications(agent.userId))[0]).toMatchObject({
      kind: 'support.requester_reply',
    });

    await replyAsStaff(agent, ticket.number, 'Fixed now.', { resolve: true });
    expect((await getMyTicket(learner, ticket.number)).status).toBe('RESOLVED');
    await setMyTicketResolved(learner, ticket.number, false);
    expect((await getMyTicket(learner, ticket.number)).status).toBe('OPEN');

    await updateTicket(agent, ticket.number, { status: 'CLOSED' });
    await expect(replyAsRequester(learner, ticket.number, 'One more thing')).rejects.toThrow(
      'closed',
    );
  });

  it('assigns only to staff, and tells the new assignee', async () => {
    const learner = await person();
    const admin = await person(['admin'], 'Admin');
    const agent = await person(['support'], 'Agent');
    const ticket = await createTicket(learner, request);
    await expect(
      updateTicket(admin, ticket.number, { assigneeId: learner.userId }),
    ).rejects.toThrow('only be assigned to staff');
    await updateTicket(admin, ticket.number, { assigneeId: agent.userId, priority: 'URGENT' });
    expect((await listNotifications(agent.userId))[0]).toMatchObject({ kind: 'support.assigned' });
    await markRead(agent.userId);
    expect(await unreadCount(agent.userId)).toBe(0);
  });

  it('lets staff filter and search, and nobody else', async () => {
    const learner = await person([], `Findable ${randomUUID().slice(0, 6)}`);
    const agent = await person(['support']);
    const ticket = await createTicket(learner, { ...request, subject: 'Unique subject words' });

    const open = await listTickets(agent, { view: 'open' });
    expect(open.tickets.some((t) => t.id === ticket.id)).toBe(true);
    expect(
      (await listTickets(agent, { view: 'all', query: `#${ticket.number}` })).tickets,
    ).toHaveLength(1);
    expect((await listTickets(agent, { view: 'all', query: learner.name })).total).toBe(1);
    expect(
      (await listTickets(agent, { view: 'mine' })).tickets.some((t) => t.id === ticket.id),
    ).toBe(false);

    await expect(listTickets(learner)).rejects.toBeInstanceOf(SupportError);
  });

  it("removes a person's requests when their account is deleted", async () => {
    const learner = await person();
    const ticket = await createTicket(learner, request);
    await getDb().user.delete({ where: { id: learner.userId } });
    expect(await getDb().supportTicket.findUnique({ where: { id: ticket.id } })).toBeNull();
  });
});

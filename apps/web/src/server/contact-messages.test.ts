import { afterAll, describe, expect, it } from 'vitest';
import {
  countOpenMessages,
  listContactMessages,
  saveContactMessage,
  setMessageHandled,
} from './contact-messages';
import { getDb } from './db';

afterAll(async () => {
  await getDb().$disconnect();
});

describe('contact messages', () => {
  it('saves messages and moves them between open and handled', async () => {
    const before = await countOpenMessages();
    const saved = await saveContactMessage({
      name: 'Visitor',
      email: 'visitor@example.org',
      company: undefined,
      inquiryType: 'partnership',
      message: 'Hello',
    });
    expect(saved).toMatchObject({ inquiryType: 'PARTNERSHIP', company: null, handledAt: null });
    expect(await countOpenMessages()).toBe(before + 1);

    await setMessageHandled(saved.id, true);
    expect((await listContactMessages()).some((m) => m.id === saved.id)).toBe(false);
    expect((await listContactMessages({ handled: true })).some((m) => m.id === saved.id)).toBe(
      true,
    );

    await setMessageHandled(saved.id, false);
    expect(await countOpenMessages()).toBe(before + 1);
  });
});

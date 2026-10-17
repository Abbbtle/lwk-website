import 'server-only';
import type { InquiryType } from '@/generated/prisma/client';
import type { ContactMessage as ContactInput } from '@/lib/forms/contact';
import { getDb } from './db';

export async function saveContactMessage(input: ContactInput) {
  return getDb().contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      inquiryType: input.inquiryType.toUpperCase() as InquiryType,
      message: input.message,
    },
  });
}

/** Newest first; open messages by default. */
export async function listContactMessages({ handled = false }: { handled?: boolean } = {}) {
  return getDb().contactMessage.findMany({
    where: { handledAt: handled ? { not: null } : null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function setMessageHandled(id: string, handled: boolean) {
  await getDb().contactMessage.update({
    where: { id },
    data: { handledAt: handled ? new Date() : null },
  });
}

export async function countOpenMessages() {
  return getDb().contactMessage.count({ where: { handledAt: null } });
}

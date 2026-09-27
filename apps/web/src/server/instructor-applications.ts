import 'server-only';
import type { ApplicationStatus } from '@/generated/prisma/client';
import type { InstructorApplication as ApplicationInput } from '@/lib/forms/instructor-application';
import { addUserToGroup } from './cognito';
import { getDb } from './db';

export class ApplicationError extends Error {
  constructor(
    readonly code: 'already_pending' | 'already_instructor' | 'not_pending' | 'not_found',
    message: string,
  ) {
    super(message);
  }
}

/** The user's most recent application, if any. */
export async function getLatestApplication(userId: string) {
  return getDb().instructorApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitInstructorApplication(userId: string, input: ApplicationInput) {
  const latest = await getLatestApplication(userId);
  if (latest?.status === 'PENDING') {
    throw new ApplicationError('already_pending', 'You already have an application under review.');
  }
  if (latest?.status === 'APPROVED') {
    throw new ApplicationError('already_instructor', 'You are already an approved instructor.');
  }
  return getDb().instructorApplication.create({
    data: {
      userId,
      ...input,
      initiatedName: input.initiatedName ?? null,
      linkedIn: input.linkedIn ?? null,
      website: input.website ?? null,
      certifications: input.certifications ?? null,
    },
  });
}

export async function listApplications(status: ApplicationStatus) {
  return getDb().instructorApplication.findMany({
    where: { status },
    // Oldest first for the review queue; newest first for decided ones.
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 200,
  });
}

export async function getApplication(id: string) {
  return getDb().instructorApplication.findUnique({
    where: { id },
    include: { reviewedBy: { select: { name: true } } },
  });
}

export async function countPendingApplications() {
  return getDb().instructorApplication.count({ where: { status: 'PENDING' } });
}

async function getPending(id: string) {
  const application = await getDb().instructorApplication.findUnique({ where: { id } });
  if (!application) throw new ApplicationError('not_found', 'Application not found.');
  if (application.status !== 'PENDING') {
    throw new ApplicationError('not_pending', 'This application has already been decided.');
  }
  return application;
}

/** Grant the instructor role first, so an application is never marked approved without it. */
export async function approveApplication(id: string, reviewerId: string, note?: string) {
  const application = await getPending(id);
  await addUserToGroup(application.userId, 'instructor');
  await getDb().instructorApplication.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewNote: note || null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

export async function rejectApplication(id: string, reviewerId: string, note?: string) {
  await getPending(id);
  await getDb().instructorApplication.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewNote: note || null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

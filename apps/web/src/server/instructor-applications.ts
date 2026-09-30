import 'server-only';
import type { ApplicationStatus } from '@/generated/prisma/client';
import type { InstructorApplication as ApplicationInput } from '@/lib/forms/instructor-application';
import { recordAudit } from './audit';
import { getDb } from './db';
import { notify } from './notifications';
import { grantRole } from './user-admin';

type Reviewer = { userId: string; name: string };

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
export async function approveApplication(id: string, reviewer: Reviewer, note?: string) {
  const application = await getPending(id);
  await grantRole(application.userId, 'instructor');
  await getDb().instructorApplication.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewNote: note || null,
      reviewedById: reviewer.userId,
      reviewedAt: new Date(),
    },
  });
  await notify(application.userId, {
    kind: 'application.approved',
    title: 'Your instructor application was approved',
    body: note || 'Open Instructor in your menu to start your first course.',
    href: '/instructor',
  });
  await recordAudit(reviewer, {
    action: 'application.approved',
    target: { type: 'user', id: application.userId },
    summary: `Approved the instructor application of ${application.fullName}`,
    details: { applicationId: id },
  });
}

export async function rejectApplication(id: string, reviewer: Reviewer, note?: string) {
  const application = await getPending(id);
  await getDb().instructorApplication.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewNote: note || null,
      reviewedById: reviewer.userId,
      reviewedAt: new Date(),
    },
  });
  await notify(application.userId, {
    kind: 'application.rejected',
    title: 'Your instructor application was not approved',
    body: note || 'You are welcome to apply again.',
    href: '/become-an-instructor',
  });
  await recordAudit(reviewer, {
    action: 'application.rejected',
    target: { type: 'user', id: application.userId },
    summary: `Declined the instructor application of ${application.fullName}`,
    details: { applicationId: id },
  });
}

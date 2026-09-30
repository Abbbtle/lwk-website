import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstructorApplication } from '@/lib/forms/instructor-application';
import { getDb } from './db';
import {
  ApplicationError,
  approveApplication,
  getLatestApplication,
  rejectApplication,
  submitInstructorApplication,
} from './instructor-applications';

const { addUserToGroup, listUserRoles } = vi.hoisted(() => ({
  addUserToGroup: vi.fn(),
  listUserRoles: vi.fn(async () => ['instructor']),
}));
vi.mock('./cognito', () => ({ addUserToGroup, listUserRoles }));

afterAll(async () => {
  await getDb().$disconnect();
});

beforeEach(() => {
  addUserToGroup.mockReset();
});

const input: InstructorApplication = {
  fullName: 'Applicant Example',
  initiatedName: undefined,
  email: 'applicant@example.org',
  nationality: 'South Africa',
  phoneNumber: '+27 82 123 4567',
  linkedIn: undefined,
  website: undefined,
  expertise: 'Kirtan',
  experienceYears: 7,
  degree: "Bachelor's degree",
  certifications: undefined,
  workExperience: 'Work',
  teachingExperience: 'Teaching',
  languages: 'English',
  motivation: 'Motivation',
  philosophy: 'Philosophy',
  strengths: 'Strengths',
};

async function createUser(name: string) {
  return getDb().user.create({
    data: { id: randomUUID(), email: `${name}@example.org`, name, lastSignInAt: new Date() },
  });
}

const reviewer = (user: { id: string; name: string }) => ({ userId: user.id, name: user.name });

describe('instructor applications', () => {
  it('allows one pending application per user', async () => {
    const user = await createUser('pending-once');
    await submitInstructorApplication(user.id, input);
    await expect(submitInstructorApplication(user.id, input)).rejects.toMatchObject({
      code: 'already_pending',
    });
  });

  it('approval grants the instructor role, then records the decision', async () => {
    const [user, admin] = await Promise.all([createUser('to-approve'), createUser('admin-a')]);
    const application = await submitInstructorApplication(user.id, input);

    await approveApplication(application.id, reviewer(admin), 'Welcome');

    expect(addUserToGroup).toHaveBeenCalledWith(user.id, 'instructor');
    // The role applies to the applicant's current session straight away.
    const updated = await getDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.roles).toEqual(['instructor']);
    expect(updated.rolesChangedAt).not.toBeNull();
    expect(
      await getDb().auditEvent.count({
        where: { action: 'application.approved', targetId: user.id, actorId: admin.id },
      }),
    ).toBe(1);
    expect(await getLatestApplication(user.id)).toMatchObject({
      status: 'APPROVED',
      reviewNote: 'Welcome',
      reviewedById: admin.id,
    });
    await expect(submitInstructorApplication(user.id, input)).rejects.toMatchObject({
      code: 'already_instructor',
    });
  });

  it('stays pending when Cognito fails, so the role and the record never disagree', async () => {
    const [user, admin] = await Promise.all([createUser('cognito-down'), createUser('admin-b')]);
    const application = await submitInstructorApplication(user.id, input);
    addUserToGroup.mockRejectedValueOnce(new Error('Cognito unavailable'));

    await expect(approveApplication(application.id, reviewer(admin))).rejects.toThrow('Cognito');
    expect((await getLatestApplication(user.id))?.status).toBe('PENDING');
  });

  it('rejection records the note, allows reapplying and cannot be decided twice', async () => {
    const [user, admin] = await Promise.all([createUser('to-reject'), createUser('admin-c')]);
    const application = await submitInstructorApplication(user.id, input);

    await rejectApplication(application.id, reviewer(admin), 'Please add teaching examples');
    expect(addUserToGroup).not.toHaveBeenCalled();
    expect(await getLatestApplication(user.id)).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Please add teaching examples',
    });

    await expect(approveApplication(application.id, reviewer(admin))).rejects.toBeInstanceOf(
      ApplicationError,
    );
    const second = await submitInstructorApplication(user.id, input);
    expect(second.status).toBe('PENDING');
  });
});

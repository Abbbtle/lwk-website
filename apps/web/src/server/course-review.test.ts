import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { Session } from './auth/session';
import * as authoring from './authoring';
import { getCourse } from './catalog';
import { publishCourse, returnCourse, unpublishCourse } from './course-review';
import { getDb } from './db';
import { testSession } from '../../test/sessions';

afterAll(async () => {
  // Remove courses created here (seeded courses have no owner) so other test files see only
  // the sample catalogue.
  await getDb().course.deleteMany({ where: { instructorId: { not: null } } });
  await getDb().$disconnect();
});

async function person(roles: Session['roles']): Promise<Session> {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'P',
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

/** A complete course submitted for review. */
async function submittedCourse(teacher: Session, title: string) {
  const course = await authoring.createCourse(teacher, { title, categorySlug: 'prasadam' });
  await authoring.updateCourseDetails(teacher, course.id, {
    title,
    subtitle: 'Sub',
    description: 'Desc',
    categorySlug: 'prasadam',
    level: 'BEGINNER',
    instructorName: 'Teacher',
    isFree: false,
    outcomes: ['Cook'],
  });
  await authoring.addSection(teacher, course.id, 'Section');
  const section = (await authoring.getCourseForEditing(teacher, course.id)).sections[0];
  const lesson = await authoring.addLesson(teacher, section.id, { title: 'L', type: 'TEXT' });
  await authoring.updateLesson(teacher, lesson.id, {
    title: 'L',
    type: 'TEXT',
    body: 'Text',
    isPreview: true,
    durationMinutes: 3,
  });
  await authoring.submitForReview(teacher, course.id);
  return await authoring.getCourseForEditing(teacher, course.id);
}

describe('course review', () => {
  it('publishing makes the course public; only admins can decide', async () => {
    const [teacher, admin] = await Promise.all([person(['instructor']), person(['admin'])]);
    const course = await submittedCourse(teacher, 'Festival Sweets');

    expect(await getCourse(course.slug)).toBeUndefined();
    await expect(publishCourse(teacher, course.id)).rejects.toMatchObject({ code: 'forbidden' });

    await publishCourse(admin, course.id);
    const live = await getCourse(course.slug);
    expect(live).toMatchObject({ title: 'Festival Sweets', lessonCount: 1, instructor: 'Teacher' });

    // Deciding twice fails instead of silently changing a live course.
    await expect(publishCourse(admin, course.id)).rejects.toMatchObject({ code: 'locked' });
  });

  it('returning requires a note and sends the course back to draft', async () => {
    const [teacher, admin] = await Promise.all([person(['instructor']), person(['admin'])]);
    const course = await submittedCourse(teacher, 'Simple Sabji');

    await expect(returnCourse(admin, course.id, '  ')).rejects.toMatchObject({
      code: 'incomplete',
    });
    await returnCourse(admin, course.id, 'Please add a second recipe.');
    const back = await authoring.getCourseForEditing(teacher, course.id);
    expect(back).toMatchObject({ status: 'DRAFT', reviewNote: 'Please add a second recipe.' });
    await authoring.addSection(teacher, course.id, 'More recipes'); // editable again
  });

  it('unpublishing takes a live course back to draft and out of the catalog', async () => {
    const [teacher, admin] = await Promise.all([person(['instructor']), person(['admin'])]);
    const course = await submittedCourse(teacher, 'Rice Dishes');
    await publishCourse(admin, course.id);

    await unpublishCourse(admin, course.id, 'Update the video');
    expect(await getCourse(course.slug)).toBeUndefined();
    const draft = await authoring.getCourseForEditing(teacher, course.id);
    expect(draft.status).toBe('DRAFT');
    // Slug stays fixed after first publication, so existing links keep working.
    await authoring.updateCourseDetails(teacher, course.id, {
      title: 'Rice Dishes Renamed',
      subtitle: 'Sub',
      description: 'Desc',
      categorySlug: 'prasadam',
      level: 'BEGINNER',
      instructorName: 'Teacher',
      isFree: false,
      outcomes: ['Cook'],
    });
    expect((await authoring.getCourseForEditing(teacher, course.id)).slug).toBe(course.slug);
  });
});

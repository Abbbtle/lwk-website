import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { Session } from './auth/session';
import * as authoring from './authoring';
import { getDb } from './db';

afterAll(async () => {
  await getDb().$disconnect();
});

async function person(roles: Session['roles'], name = 'Person'): Promise<Session> {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name,
      lastSignInAt: new Date(),
    },
  });
  return { userId: user.id, email: user.email, name, roles };
}

const details = {
  title: 'Japa Foundations',
  subtitle: 'Chant with attention',
  description: 'A practical course on japa.',
  categorySlug: 'vaisnava-etiquette',
  level: 'BEGINNER' as const,
  instructorName: 'Japa Teacher',
  outcomes: ['Chant sixteen rounds steadily'],
};

describe('slugify', () => {
  it('makes readable, URL-safe slugs', () => {
    expect(authoring.slugify('Śrī Īśopaniṣad: Verse by Verse!')).toBe(
      'sri-isopanisad-verse-by-verse',
    );
    expect(authoring.slugify('***')).toBe('course');
  });
});

describe('course authoring', () => {
  it('only instructors can create courses; slugs stay unique', async () => {
    const learner = await person([]);
    await expect(
      authoring.createCourse(learner, { title: 'Nope', categorySlug: 'kirtan' }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    const teacher = await person(['instructor'], 'Teacher One');
    const a = await authoring.createCourse(teacher, {
      title: 'Kirtan Basics',
      categorySlug: 'kirtan',
    });
    expect(a).toMatchObject({
      status: 'DRAFT',
      instructorId: teacher.userId,
      instructorName: 'Teacher One',
    });
    // "kirtan-basics" is taken by the sample catalogue.
    expect(a.slug).toBe('kirtan-basics-2');
  });

  it('other instructors cannot see or edit a course; admins can', async () => {
    const owner = await person(['instructor']);
    const other = await person(['instructor']);
    const admin = await person(['admin']);
    const course = await authoring.createCourse(owner, { title: 'Owned', categorySlug: 'kirtan' });

    await expect(authoring.getCourseForEditing(other, course.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(authoring.addSection(other, course.id, 'Hijack')).rejects.toMatchObject({
      code: 'not_found',
    });
    await authoring.addSection(admin, course.id, 'Added by admin');
    expect((await authoring.getCourseForEditing(owner, course.id)).sections).toHaveLength(1);
  });

  it('reorders sections and lessons', async () => {
    const teacher = await person(['instructor']);
    const course = await authoring.createCourse(teacher, {
      title: 'Order',
      categorySlug: 'kirtan',
    });
    for (const title of ['One', 'Two', 'Three'])
      await authoring.addSection(teacher, course.id, title);
    let c = await authoring.getCourseForEditing(teacher, course.id);
    await authoring.moveSection(teacher, c.sections[2].id, 'up');
    await authoring.moveSection(teacher, c.sections[0].id, 'up'); // already first: no change
    c = await authoring.getCourseForEditing(teacher, course.id);
    expect(c.sections.map((s) => s.title)).toEqual(['One', 'Three', 'Two']);

    const sectionId = c.sections[0].id;
    const first = await authoring.addLesson(teacher, sectionId, { title: 'L1', type: 'TEXT' });
    await authoring.addLesson(teacher, sectionId, { title: 'L2', type: 'TEXT' });
    await authoring.moveLesson(teacher, first.id, 'down');
    c = await authoring.getCourseForEditing(teacher, course.id);
    expect(c.sections[0].lessons.map((l) => l.title)).toEqual(['L2', 'L1']);
  });

  it('submits only complete courses and locks them while in review', async () => {
    const teacher = await person(['instructor']);
    const admin = await person(['admin']);
    const course = await authoring.createCourse(teacher, {
      title: 'Review Me',
      categorySlug: 'vaisnava-etiquette',
    });

    await expect(authoring.submitForReview(teacher, course.id)).rejects.toMatchObject({
      code: 'incomplete',
    });

    await authoring.updateCourseDetails(teacher, course.id, details);
    await authoring.addSection(teacher, course.id, 'Getting started');
    const section = (await authoring.getCourseForEditing(teacher, course.id)).sections[0];
    const lesson = await authoring.addLesson(teacher, section.id, {
      title: 'Why chant',
      type: 'TEXT',
    });

    let checklist = authoring.reviewChecklist(
      await authoring.getCourseForEditing(teacher, course.id),
    );
    expect(checklist).toEqual(['Write the text for "Why chant".']);

    await authoring.updateLesson(teacher, lesson.id, {
      title: 'Why chant',
      type: 'TEXT',
      body: 'Because...',
      isPreview: true,
      durationMinutes: 5,
    });
    checklist = authoring.reviewChecklist(await authoring.getCourseForEditing(teacher, course.id));
    expect(checklist).toEqual([]);

    await authoring.submitForReview(teacher, course.id);
    const submitted = await authoring.getCourseForEditing(teacher, course.id);
    expect(submitted.status).toBe('IN_REVIEW');
    expect(submitted.slug).toBe('japa-foundations');

    await expect(authoring.addSection(teacher, course.id, 'Too late')).rejects.toMatchObject({
      code: 'locked',
    });
    await authoring.addSection(admin, course.id, 'Admin fix'); // admins may still edit

    await authoring.withdrawSubmission(teacher, course.id);
    await authoring.addSection(teacher, course.id, 'Back to editing');
    expect((await authoring.getCourseForEditing(teacher, course.id)).status).toBe('DRAFT');
  });

  it('flags video and PDF lessons that still need a file', async () => {
    const teacher = await person(['instructor']);
    const course = await authoring.createCourse(teacher, {
      title: 'Media',
      categorySlug: 'kirtan',
    });
    await authoring.updateCourseDetails(teacher, course.id, { ...details, title: 'Media' });
    await authoring.addSection(teacher, course.id, 'Section');
    const section = (await authoring.getCourseForEditing(teacher, course.id)).sections[0];
    await authoring.addLesson(teacher, section.id, { title: 'Watch', type: 'VIDEO' });
    await authoring.addLesson(teacher, section.id, { title: 'Read', type: 'PDF' });
    expect(
      authoring.reviewChecklist(await authoring.getCourseForEditing(teacher, course.id)),
    ).toEqual(['Upload the video for "Watch".', 'Upload the PDF for "Read".']);
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { Session } from './auth/session';
import { getDb } from './db';
import { enroll, getPlayer, LearningError, listMyLearning, saveProgress } from './learning';
import { testSession } from '../../test/sessions';

// Uses the seeded sample course "kirtan-basics": 15 lessons, the first one a free preview.
const SLUG = 'kirtan-basics';

afterAll(async () => {
  await getDb().$disconnect();
});

async function learner(roles: Session['roles'] = []): Promise<Session> {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'L',
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

describe('access', () => {
  it('visitors and non-enrolled learners can open only preview lessons', async () => {
    const anonymous = await getPlayer(null, SLUG);
    expect(anonymous.lesson.isPreview).toBe(true);
    expect(anonymous.lesson.unlocked).toBe(true);
    expect(anonymous.canTrackProgress).toBe(false);

    const locked = anonymous.sections.flatMap((s) => s.lessons).find((l) => !l.isPreview)!;
    const view = await getPlayer(null, SLUG, locked.id);
    expect(view.lesson.unlocked).toBe(false);
    expect(view.mediaUrl).toBeNull();
  });

  it('enrolled learners and admins can open every lesson', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const player = await getPlayer(student, SLUG);
    expect(player.enrolled).toBe(true);
    expect(player.sections.flatMap((s) => s.lessons).every((l) => l.unlocked)).toBe(true);

    const admin = await learner(['admin']);
    const adminView = await getPlayer(admin, SLUG);
    expect(adminView.enrolled).toBe(false);
    expect(adminView.sections.flatMap((s) => s.lessons).every((l) => l.unlocked)).toBe(true);
  });

  it('cannot enroll in unknown or unpublished courses', async () => {
    const student = await learner();
    await expect(enroll(student, 'no-such-course')).rejects.toBeInstanceOf(LearningError);
  });
});

describe('progress', () => {
  it('saves position, resumes at the first incomplete lesson and completes the course', async () => {
    const student = await learner();
    // Not enrolled yet: progress is not tracked.
    const first = (await getPlayer(student, SLUG)).lesson;
    await expect(saveProgress(student, first.id, { completed: true })).rejects.toMatchObject({
      code: 'not_enrolled',
    });

    await enroll(student, SLUG);
    await saveProgress(student, first.id, { positionSeconds: 42.6 });
    expect((await getPlayer(student, SLUG, first.id)).resumeAt).toBe(43);

    await saveProgress(student, first.id, { completed: true });
    const next = await getPlayer(student, SLUG);
    expect(next.lesson.id).not.toBe(first.id); // resumes at the next incomplete lesson
    expect(next.completedCount).toBe(1);

    const all = next.sections.flatMap((s) => s.lessons);
    for (const lesson of all) await saveProgress(student, lesson.id, { completed: true });
    const [course] = await listMyLearning(student.userId);
    expect(course).toMatchObject({
      slug: SLUG,
      percent: 100,
      completed: true,
      totalLessons: all.length,
    });

    // Un-completing a lesson reopens the course.
    await saveProgress(student, first.id, { completed: false });
    const [reopened] = await listMyLearning(student.userId);
    expect(reopened.completed).toBe(false);
    expect(reopened.completedCount).toBe(all.length - 1);
  });

  it('keeps the original completion time and lists most recent courses first', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const lesson = (await getPlayer(student, SLUG)).lesson;
    await saveProgress(student, lesson.id, { completed: true });
    const firstTime = (
      await getDb().lessonProgress.findFirstOrThrow({ where: { userId: student.userId } })
    ).completedAt;
    await saveProgress(student, lesson.id, { completed: true });
    const again = await getDb().lessonProgress.findFirstOrThrow({
      where: { userId: student.userId },
    });
    expect(again.completedAt).toEqual(firstTime);

    await enroll(student, 'mastering-harmonium');
    expect((await listMyLearning(student.userId)).map((c) => c.slug)).toEqual([
      'mastering-harmonium',
      SLUG,
    ]);
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { dismissChecklist, instructorChecklist, learnerChecklist } from './onboarding';

afterAll(async () => {
  await getDb().course.deleteMany({ where: { instructorId: { not: null } } });
  await getDb().$disconnect();
});

async function user() {
  return getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'New Person',
      lastSignInAt: new Date(),
    },
  });
}

describe('getting-started checklists', () => {
  it('follows what a learner has done, and can be hidden', async () => {
    const { id } = await user();
    const first = await learnerChecklist(id, false);
    expect(first?.items.filter((i) => i.done).map((i) => i.label)).toEqual(['Create your account']);

    const course = await getDb().course.findFirstOrThrow({ where: { status: 'PUBLISHED' } });
    await getDb().enrollment.create({ data: { userId: id, courseId: course.id } });
    const second = await learnerChecklist(id, true);
    expect(second?.items.filter((i) => i.done)).toHaveLength(3);

    await dismissChecklist(id, 'learner-start');
    await dismissChecklist(id, 'learner-start');
    expect(await learnerChecklist(id, true)).toBeNull();
    expect((await getDb().user.findUniqueOrThrow({ where: { id } })).dismissedTips).toEqual([
      'learner-start',
    ]);
  });

  it('guides a new instructor to a first course', async () => {
    const { id } = await user();
    expect((await instructorChecklist(id))?.items.every((i) => !i.done)).toBe(true);
    const category = await getDb().category.findFirstOrThrow();
    await getDb().course.create({
      data: {
        slug: `checklist-${randomUUID()}`,
        title: 'First course',
        subtitle: '',
        description: '',
        level: 'BEGINNER',
        instructorId: id,
        instructorName: 'New Person',
        categoryId: category.id,
      },
    });
    expect((await instructorChecklist(id))?.items[0]).toMatchObject({ done: true });
  });
});

import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { type CoursePricing, coursePricingColumns } from '@/lib/pricing';
import { getDb } from './db';

// The payments_access migration grants early access for the enrolments made before it. Its
// statement runs here inside a transaction that is rolled back, so other tests' data stays as it is.

const MIGRATIONS = path.join(import.meta.dirname, '../../prisma/migrations');
const SLUG_PREFIX = 'backfill-';

function backfillStatement(): string {
  const folder = readdirSync(MIGRATIONS).find((name) => name.endsWith('_payments_access'));
  if (!folder) throw new Error('The payments_access migration is missing.');
  const sql = readFileSync(path.join(MIGRATIONS, folder, 'migration.sql'), 'utf8');
  const statement = sql.match(/INSERT INTO "course_access"[\s\S]*?;/)?.[0];
  if (!statement) throw new Error('The payments_access migration has no early-access backfill.');
  return statement;
}

class RollBack extends Error {}

/** Runs `work` in a transaction and rolls it back, returning what `work` returned. */
async function rolledBack<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let result: { value: T } | undefined;
  await getDb()
    .$transaction(async (tx) => {
      result = { value: await work(tx) };
      throw new RollBack();
    })
    .catch((error) => {
      if (!(error instanceof RollBack)) throw error;
    });
  if (!result) throw new Error('The transaction did not run.');
  return result.value;
}

async function course(pricing: CoursePricing) {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `${SLUG_PREFIX}${randomUUID()}`,
      title: `Backfill ${pricing.kind}`,
      subtitle: '',
      description: '',
      level: 'BEGINNER',
      status: 'PUBLISHED',
      instructorName: 'T',
      categoryId: category.id,
      ...coursePricingColumns(pricing),
    },
  });
}

async function person() {
  return getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Early learner',
      lastSignInAt: new Date(),
    },
  });
}

afterAll(async () => {
  await getDb().course.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await getDb().$disconnect();
});

describe('the early-access backfill', () => {
  it('grants every enrolment in a course that is not free, dated when the learner enrolled', async () => {
    const [free, tier, unpriced] = await Promise.all([
      course({ kind: 'free' }),
      course({ kind: 'tier', tier: 2 }),
      course({ kind: 'unpriced' }),
    ]);
    const [learner, buyer] = await Promise.all([person(), person()]);
    const enrolledAt = new Date('2026-09-01T10:00:00Z');
    await getDb().enrollment.createMany({
      data: [free, tier, unpriced].map((c) => ({ userId: learner.id, courseId: c.id, enrolledAt })),
    });
    // A grant that is already there stays as it is.
    await getDb().enrollment.create({ data: { userId: buyer.id, courseId: tier.id } });
    await getDb().courseAccess.create({
      data: { userId: buyer.id, courseId: tier.id, source: 'PURCHASE' },
    });

    const grants = await rolledBack(async (tx) => {
      await tx.$executeRawUnsafe(backfillStatement());
      return tx.courseAccess.findMany({
        where: { userId: { in: [learner.id, buyer.id] } },
        select: { userId: true, courseId: true, source: true, grantedAt: true, revokedAt: true },
      });
    });

    expect(grants).toHaveLength(3);
    expect(grants).toEqual(
      expect.arrayContaining([
        {
          userId: learner.id,
          courseId: tier.id,
          source: 'EARLY_ACCESS',
          grantedAt: enrolledAt,
          revokedAt: null,
        },
        {
          userId: learner.id,
          courseId: unpriced.id,
          source: 'EARLY_ACCESS',
          grantedAt: enrolledAt,
          revokedAt: null,
        },
        expect.objectContaining({ userId: buyer.id, courseId: tier.id, source: 'PURCHASE' }),
      ]),
    );
    expect(grants.some((grant) => grant.courseId === free.id)).toBe(false);
  });
});

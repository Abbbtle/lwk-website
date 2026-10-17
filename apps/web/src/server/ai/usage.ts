import 'server-only';
import { getDb } from '../db';
import { aiConfig } from './config';
import { costMicros, type TokenUsage } from './pricing';

// Metering: every model call is recorded with its estimated cost, and calls stop for the rest
// of the month once the cap is reached.

export type UsageOutcome = 'ok' | 'error' | 'limited' | 'unavailable';

export async function recordUsage(input: {
  userId?: string;
  feature: string;
  model: string;
  usage?: TokenUsage;
  outcome: UsageOutcome;
}) {
  const usage = input.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  try {
    await getDb().aiUsage.create({
      data: {
        userId: input.userId ?? null,
        feature: input.feature,
        model: input.model,
        ...usage,
        costMicros: costMicros(input.model, usage),
        outcome: input.outcome,
      },
    });
  } catch (error) {
    console.error('Recording AI usage failed', error);
  }
}

/** Start of the current month in UTC. */
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthSpendMicros() {
  const result = await getDb().aiUsage.aggregate({
    where: { createdAt: { gte: monthStart() } },
    _sum: { costMicros: true },
  });
  return result._sum.costMicros ?? 0;
}

/** Whether there is budget left this month (with a small reserve for a call in flight). */
export async function withinBudget() {
  const capMicros = aiConfig().monthlyBudgetUsd * 1_000_000;
  return (await monthSpendMicros()) < capMicros - 20_000;
}

/** Spend and activity for the admin AI page. */
export async function usageReport() {
  const since = monthStart();
  const db = getDb();
  const [spend, byFeature, byOutcome, feedback] = await Promise.all([
    monthSpendMicros(),
    db.aiUsage.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: since } },
      _sum: { costMicros: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    db.aiUsage.groupBy({
      by: ['outcome'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.aiFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const days = await db.$queryRaw<{ day: Date; calls: bigint; micros: bigint }[]>`
    SELECT date_trunc('day', created_at) AS day, count(*) AS calls, coalesce(sum(cost_micros), 0) AS micros
    FROM ai_usage WHERE created_at >= ${since}
    GROUP BY 1 ORDER BY 1`;
  return {
    capUsd: aiConfig().monthlyBudgetUsd,
    spendUsd: spend / 1_000_000,
    byFeature: byFeature.map((row) => ({
      feature: row.feature,
      calls: row._count._all,
      costUsd: (row._sum.costMicros ?? 0) / 1_000_000,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
    })),
    byOutcome: Object.fromEntries(byOutcome.map((row) => [row.outcome, row._count._all])),
    days: days.map((d) => ({
      day: d.day,
      calls: Number(d.calls),
      costUsd: Number(d.micros) / 1_000_000,
    })),
    feedback,
  };
}

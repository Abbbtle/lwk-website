import 'server-only';

// AI settings come from the environment (Parameter Store /lwk/<stage>/web/* in AWS), so models,
// the monthly cap and the on/off switch change without a code release.

export type AiModelRole = 'assistant' | 'writer';

export function aiConfig() {
  return {
    /** Master switch. Without it every AI feature falls back to non-AI help. */
    enabled: process.env.AI_ENABLED !== 'false',
    /** Region the app calls Bedrock in; global inference profiles route from there. */
    region: process.env.AI_REGION ?? process.env.AWS_REGION ?? 'af-south-1',
    models: {
      // Fast and inexpensive: the assistant on every page.
      assistant:
        process.env.AI_ASSISTANT_MODEL ?? 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      // Stronger writing and reasoning: study help and authoring tools.
      writer: process.env.AI_WRITER_MODEL ?? 'global.anthropic.claude-sonnet-5',
    } satisfies Record<AiModelRole, string>,
    /** Hard monthly cap on estimated AI spend (USD). */
    monthlyBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD ?? 5),
  };
}

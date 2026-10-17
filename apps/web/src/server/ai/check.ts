import 'server-only';
import { aiConfig, type AiModelRole } from './config';
import { AiUnavailableError, converseStream, resetAiCircuit } from './bedrock';
import { recordUsage } from './usage';

/** A tiny real call to each model, so admins can confirm AI access works (costs a fraction of a cent). */
export async function checkAiAccess(userId: string) {
  resetAiCircuit();
  const config = aiConfig();
  const results: { role: AiModelRole; model: string; ok: boolean; detail: string }[] = [];
  for (const role of ['assistant', 'writer'] as const) {
    const model = config.models[role];
    try {
      let reply = '';
      for await (const event of converseStream({
        model,
        system: 'Reply with the single word: ready',
        messages: [{ role: 'user', content: [{ text: 'Are you ready?' }] }],
        maxTokens: 10,
        temperature: 0,
      })) {
        if (event.type === 'text') reply += event.text;
        if (event.type === 'done') {
          await recordUsage({
            userId,
            feature: 'access-check',
            model,
            usage: event.usage,
            outcome: 'ok',
          });
        }
      }
      results.push({ role, model, ok: true, detail: reply.trim() || '(empty reply)' });
    } catch (error) {
      await recordUsage({
        userId,
        feature: 'access-check',
        model,
        outcome: error instanceof AiUnavailableError ? 'unavailable' : 'error',
      });
      results.push({ role, model, ok: false, detail: (error as Error).message.slice(0, 300) });
      resetAiCircuit();
    }
  }
  return results;
}

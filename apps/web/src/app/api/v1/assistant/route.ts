import { z } from 'zod';
import { fail } from '@/server/api';
import { runAssistant } from '@/server/ai/assistant';
import { getSession, hasRole, type Session } from '@/server/auth/session';
import { rateLimit } from '@/server/rate-limit';
import { ipFromHeaders } from '@/server/request-info';

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20)
    .refine((m) => m.at(-1)?.role === 'user', 'The last message must be a question.')
    .refine(
      (m) => (m.at(-1)?.content.length ?? 0) <= 2000,
      'Questions can be up to 2,000 characters.',
    ),
  path: z.string().max(300).startsWith('/').default('/'),
});

/** Questions a day: generous for people with accounts, modest for visitors. */
function dailyLimit(session: Session | null) {
  if (!session) return 20;
  if (hasRole(session, 'support')) return 150;
  if (hasRole(session, 'instructor')) return 80;
  return 50;
}

// The help panel's assistant. Streams newline-delimited JSON events (see AssistantEvent).
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail(400, 'bad_request', parsed.error.issues[0]?.message ?? 'Invalid request.');

  const session = await getSession();
  const who = session ? `user:${session.userId}` : `ip:${ipFromHeaders(request.headers)}`;
  const [burst, daily] = await Promise.all([
    rateLimit(`assistant-burst:${who}`, { limit: 6, windowSeconds: 60 }),
    rateLimit(`assistant:${who}`, { limit: dailyLimit(session), windowSeconds: 24 * 60 * 60 }),
  ]);
  if (!burst.ok || !daily.ok) {
    return fail(
      429,
      'rate_limited',
      !burst.ok
        ? 'That is a lot of questions at once. Please wait a moment.'
        : 'You have reached today’s limit for the assistant. The help centre and support are always available.',
    );
  }

  // Only the last ten turns are sent to the model.
  const turns = parsed.data.messages.slice(-10);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAssistant({ session, turns, path: parsed.data.path, emit });
      } catch (error) {
        console.error('Assistant request failed', error);
        emit({ type: 'fallback', reason: 'unavailable', articles: [] });
        emit({ type: 'done' });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSession } from '../../../test/sessions';
import type { Role } from '../auth/session';
import { getDb } from '../db';
import { type AssistantEvent, describePage, runAssistant, systemPrompt } from './assistant';
import { resetAiCircuit } from './bedrock';

// Bedrock stand-in: each call to send() takes the next scripted response.
type Script = { events?: object[]; error?: Error };
const bedrock = vi.hoisted(() => ({
  scripts: [] as Script[],
  inputs: [] as Record<string, unknown>[],
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    async send(command: { input: Record<string, unknown> }) {
      // A copy: the app keeps adding to the same message list after the call.
      bedrock.inputs.push(structuredClone(command.input));
      const script = bedrock.scripts.shift() ?? { events: [] };
      if (script.error) throw script.error;
      return {
        stream: (async function* () {
          yield* script.events ?? [];
        })(),
      };
    }
  },
  ConverseStreamCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
}));

const usage = (input = 100, output = 20) => ({
  metadata: {
    usage: {
      inputTokens: input,
      outputTokens: output,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    },
  },
});
const text = (...parts: string[]) => [
  ...parts.map((t) => ({ contentBlockDelta: { contentBlockIndex: 0, delta: { text: t } } })),
  { messageStop: { stopReason: 'end_turn' } },
  usage(),
];
const toolCall = (name: string, input: object) => [
  { contentBlockStart: { contentBlockIndex: 0, start: { toolUse: { toolUseId: 't1', name } } } },
  {
    contentBlockDelta: {
      contentBlockIndex: 0,
      delta: { toolUse: { input: JSON.stringify(input) } },
    },
  },
  { messageStop: { stopReason: 'tool_use' } },
  usage(),
];

async function run(
  turns: { role: 'user' | 'assistant'; content: string }[],
  roles: Role[] | null = null,
  path = '/',
) {
  const session = roles ? await person(roles) : null;
  const events: AssistantEvent[] = [];
  await runAssistant({ session, turns, path, emit: (e) => events.push(e) });
  return { events, session };
}

async function person(roles: Role[] = []) {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Asker',
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

const ask = (content: string) => [{ role: 'user' as const, content }];

beforeEach(async () => {
  bedrock.scripts = [];
  bedrock.inputs = [];
  resetAiCircuit();
  await getDb().aiUsage.deleteMany({});
});

afterAll(async () => {
  await getDb().aiUsage.deleteMany({});
  await getDb().$disconnect();
});

describe('assistant', () => {
  it('streams an answer, lists the pages it links to, and meters the call', async () => {
    bedrock.scripts.push({ events: text('Open ', '[My Learning](/my-learning) to continue.') });
    const { events } = await run(ask('Where are my courses?'), []);
    expect(
      events
        .filter((e) => e.type === 'text')
        .map((e) => (e as { text: string }).text)
        .join(''),
    ).toBe('Open [My Learning](/my-learning) to continue.');
    expect(events).toContainEqual({
      type: 'sources',
      items: [{ href: '/my-learning', title: 'My Learning' }],
    });
    expect(events.at(-1)).toEqual({ type: 'done' });
    const row = await getDb().aiUsage.findFirstOrThrow();
    expect(row).toMatchObject({
      feature: 'assistant',
      outcome: 'ok',
      inputTokens: 100,
      outputTokens: 20,
    });
    expect(row.costMicros).toBe(100 * 1 + 20 * 5);
  });

  it('looks things up with tools and answers with the results', async () => {
    bedrock.scripts.push(
      { events: toolCall('search_catalog', { query: 'kirtan' }) },
      { events: text('Try Kirtan Basics.') },
    );
    const { events } = await run(ask('Any kirtan courses?'));
    expect(bedrock.inputs).toHaveLength(2);
    const second = bedrock.inputs[1].messages as {
      role: string;
      content: { toolResult?: { content: { text: string }[] } }[];
    }[];
    const result = second.at(-1)!.content[0].toolResult!.content[0].text;
    expect(JSON.parse(result)).toHaveProperty('courses');
    expect(events.some((e) => e.type === 'text' && e.text.includes('Kirtan Basics'))).toBe(true);
    // Two model calls, both metered in one record.
    expect((await getDb().aiUsage.findFirstOrThrow()).inputTokens).toBe(200);
  });

  it('only offers tools the person may use', async () => {
    bedrock.scripts.push({ events: text('Hi') }, { events: text('Hi') });
    await run(ask('Hello'));
    await run(ask('Hello'), ['support']);
    const names = (input: Record<string, unknown>) =>
      (input.toolConfig as { tools: { toolSpec?: { name: string } }[] }).tools
        .map((t) => t.toolSpec?.name)
        .filter(Boolean);
    expect(names(bedrock.inputs[0])).not.toContain('my_learning');
    expect(names(bedrock.inputs[0])).not.toContain('staff_overview');
    expect(names(bedrock.inputs[1])).toEqual(
      expect.arrayContaining(['my_learning', 'staff_overview']),
    );
  });

  it('offers a hand-over to a person', async () => {
    bedrock.scripts.push(
      {
        events: toolCall('offer_support_handoff', {
          subject: 'Lost authenticator',
          reason: 'Needs a reset',
        }),
      },
      { events: text('I have added a button to contact support.') },
    );
    const { events } = await run(ask('I lost my phone and cannot log in'));
    expect(events).toContainEqual({
      type: 'handoff',
      subject: 'Lost authenticator',
      reason: 'Needs a reset',
    });
  });

  it('falls back to help articles when the model cannot be used, then stops trying for a while', async () => {
    const denied = Object.assign(new Error('not available for this account'), {
      name: 'AccessDeniedException',
    });
    bedrock.scripts.push({ error: denied });
    const first = await run(ask('How do I reset my password?'));
    const fallback = first.events.find((e) => e.type === 'fallback');
    expect(fallback).toMatchObject({ reason: 'unavailable' });
    expect((fallback as { articles: { slug: string }[] }).articles[0].slug).toBe(
      'resetting-your-password',
    );

    const second = await run(ask('And now?'));
    expect(bedrock.inputs).toHaveLength(1); // Not called again.
    expect(second.events.some((e) => e.type === 'fallback')).toBe(true);
    expect(await getDb().aiUsage.count({ where: { outcome: 'unavailable' } })).toBe(2);
  });

  it('stops at the monthly spending cap', async () => {
    await getDb().aiUsage.create({
      data: { feature: 'assistant', model: 'm', outcome: 'ok', costMicros: 5_000_000 },
    });
    const { events } = await run(ask('Hello'));
    expect(bedrock.inputs).toHaveLength(0);
    expect(events.find((e) => e.type === 'fallback')).toMatchObject({ reason: 'budget' });
  });
});

describe('assistant context', () => {
  it('knows the help centre, with staff articles only for staff', async () => {
    const learnerPrompt = systemPrompt(null, 'The page at /.');
    expect(learnerPrompt).toContain('/help/two-step-verification');
    expect(learnerPrompt).not.toContain('/help/handling-support-requests');
    const staffPrompt = systemPrompt(await person(['support']), 'The page at /.');
    expect(staffPrompt).toContain('/help/handling-support-requests');
  });

  it('includes lesson text only for people who may read the lesson', async () => {
    const category = await getDb().category.findFirstOrThrow();
    const course = await getDb().course.create({
      data: {
        slug: `ai-context-${randomUUID()}`,
        title: 'Context Course',
        subtitle: '',
        description: '',
        level: 'BEGINNER',
        status: 'PUBLISHED',
        instructorName: 'T',
        categoryId: category.id,
        sections: {
          create: {
            title: 'S',
            position: 0,
            lessons: {
              create: {
                title: 'Secret lesson',
                type: 'TEXT',
                position: 0,
                body: 'The hidden lesson text.',
              },
            },
          },
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    const path = `/learn/${course.slug}/${course.sections[0].lessons[0].id}`;
    expect(await describePage(path, null)).not.toContain('hidden lesson text');
    const learner = await person();
    await getDb().enrollment.create({ data: { userId: learner.userId, courseId: course.id } });
    expect(await describePage(path, learner)).toContain('hidden lesson text');
    await getDb().course.delete({ where: { id: course.id } });
  });
});

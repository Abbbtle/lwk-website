import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testSession } from '../../../test/sessions';
import type { Role } from '../auth/session';
import * as authoring from '../authoring';
import { getDb } from '../db';
import { createTicket } from '../support';
import { resetAiCircuit } from './bedrock';
import {
  applyOutline,
  draftOutline,
  draftSupportReply,
  lessonQuiz,
  reviewCourse,
  summariseApplication,
} from './tools';

// Bedrock stand-in: each call returns the next scripted tool input (the structured result).
const bedrock = vi.hoisted(() => ({
  results: [] as (object | Error)[],
  inputs: [] as Record<string, unknown>[],
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    async send(command: { input: Record<string, unknown> }) {
      bedrock.inputs.push(structuredClone(command.input));
      const next = bedrock.results.shift();
      if (next instanceof Error) throw next;
      const name = (command.input.toolConfig as { toolChoice: { tool: { name: string } } })
        .toolChoice.tool.name;
      return {
        stream: (async function* () {
          yield {
            contentBlockStart: {
              contentBlockIndex: 0,
              start: { toolUse: { toolUseId: 't', name } },
            },
          };
          yield {
            contentBlockDelta: {
              contentBlockIndex: 0,
              delta: { toolUse: { input: JSON.stringify(next ?? {}) } },
            },
          };
          yield { messageStop: { stopReason: 'tool_use' } };
          yield { metadata: { usage: { inputTokens: 1000, outputTokens: 300 } } };
        })(),
      };
    }
  },
  ConverseStreamCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
}));

const quiz = {
  questions: [0, 1, 2].map((i) => ({
    question: `Question number ${i}?`,
    options: ['A', 'B', 'C', 'D'],
    answer: i,
    explanation: 'Because the lesson says so.',
  })),
};
const lessonText = 'Kirtan is the congregational singing of the holy names. '.repeat(6);

async function person(roles: Role[] = []) {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Person',
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

async function publishedCourse(body: string, isPreview = false) {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `ai-tools-${randomUUID()}`,
      title: 'Kirtan Course',
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
          lessons: { create: { title: 'Lesson', type: 'TEXT', position: 0, body, isPreview } },
        },
      },
    },
    include: { sections: { include: { lessons: true } } },
  });
}

beforeEach(async () => {
  bedrock.results = [];
  bedrock.inputs = [];
  resetAiCircuit();
  await getDb().aiUsage.deleteMany({});
  await getDb().rateLimit.deleteMany({});
});

afterAll(async () => {
  await getDb().course.deleteMany({ where: { slug: { startsWith: 'ai-tools-' } } });
  await getDb().course.deleteMany({ where: { instructorId: { not: null } } });
  await getDb().aiUsage.deleteMany({});
  await getDb().$disconnect();
});

describe('practice quizzes', () => {
  it('are only for people who may read the lesson', async () => {
    const course = await publishedCourse(lessonText);
    const outsider = await person();
    await expect(lessonQuiz(outsider, course.sections[0].lessons[0].id)).rejects.toThrow(
      'Lesson not found',
    );
    expect(bedrock.inputs).toHaveLength(0);
  });

  it('are made once, shared, and made again when the lesson changes', async () => {
    const course = await publishedCourse(lessonText, true);
    const lessonId = course.sections[0].lessons[0].id;
    const [a, b] = [await person(), await person()];
    bedrock.results.push(quiz);
    expect((await lessonQuiz(a, lessonId)).questions).toHaveLength(3);
    expect((await lessonQuiz(b, lessonId)).questions).toHaveLength(3);
    expect(bedrock.inputs).toHaveLength(1); // The second learner got the stored quiz.

    await getDb().lesson.update({ where: { id: lessonId }, data: { body: `${lessonText} More.` } });
    bedrock.results.push(quiz);
    await lessonQuiz(a, lessonId);
    expect(bedrock.inputs).toHaveLength(2);
    const usage = await getDb().aiUsage.findMany({ where: { feature: 'lesson-helper' } });
    expect(usage.every((u) => u.outcome === 'ok' && u.costMicros > 0)).toBe(true);
  });

  it('need enough lesson text, and reject malformed model output', async () => {
    const short = await publishedCourse('Too short.', true);
    const learner = await person();
    await expect(lessonQuiz(learner, short.sections[0].lessons[0].id)).rejects.toThrow(
      'enough text',
    );

    const course = await publishedCourse(lessonText, true);
    bedrock.results.push({ questions: [{ question: 'Only one?' }] });
    await expect(lessonQuiz(learner, course.sections[0].lessons[0].id)).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('fall back gracefully when AI is unavailable or over budget', async () => {
    const course = await publishedCourse(lessonText, true);
    const learner = await person();
    bedrock.results.push(
      Object.assign(new Error('not available for this account'), { name: 'AccessDeniedException' }),
    );
    await expect(lessonQuiz(learner, course.sections[0].lessons[0].id)).rejects.toMatchObject({
      code: 'unavailable',
    });

    resetAiCircuit();
    await getDb().aiUsage.create({
      data: { feature: 'x', model: 'm', outcome: 'ok', costMicros: 5_000_000 },
    });
    await expect(lessonQuiz(learner, course.sections[0].lessons[0].id)).rejects.toMatchObject({
      code: 'budget',
    });
  });
});

describe('instructor tools', () => {
  it('suggest an outline and add it to a draft, but not to a course in review', async () => {
    const teacher = await person(['instructor']);
    const course = await authoring.createCourse(teacher, {
      title: 'Harmonium Basics',
      categorySlug: 'kirtan',
    });
    const outline = {
      sections: [
        {
          title: 'Getting started',
          lessons: [{ title: 'Meet the harmonium', type: 'VIDEO', summary: 'Parts and care.' }],
        },
        {
          title: 'First songs',
          lessons: [{ title: 'A simple melody', type: 'TEXT', summary: 'Step by step.' }],
        },
      ],
      advice: 'Keep lessons short.',
    };
    bedrock.results.push(outline);
    const suggested = await draftOutline(teacher, course.id, {
      about: 'Playing the harmonium for kirtan',
      size: 'short',
    });
    expect(suggested.sections).toHaveLength(2);

    await applyOutline(teacher, course.id, suggested);
    const updated = await authoring.getCourseForEditing(teacher, course.id);
    expect(updated.sections.map((s) => s.title)).toEqual(['Getting started', 'First songs']);
    expect(updated.sections[0].lessons[0]).toMatchObject({
      title: 'Meet the harmonium',
      type: 'VIDEO',
    });

    await getDb().course.update({ where: { id: course.id }, data: { status: 'IN_REVIEW' } });
    await expect(
      draftOutline(teacher, course.id, { about: 'Something else entirely' }),
    ).rejects.toThrow('Only drafts');
  });

  it('review a course with its text for instructors and admins', async () => {
    const teacher = await person(['instructor']);
    const admin = await person(['admin']);
    const course = await authoring.createCourse(teacher, {
      title: 'Temple Etiquette',
      categorySlug: 'vaisnava-etiquette',
    });
    const review = {
      ready: false,
      summary: 'A good start.',
      suggestions: [{ area: 'details', severity: 'must', detail: 'Add a description.' }],
    };
    bedrock.results.push(review, review);
    expect((await reviewCourse(teacher, course.id)).suggestions).toHaveLength(1);
    expect((await reviewCourse(admin, course.id)).ready).toBe(false);
    const other = await person(['instructor']);
    await expect(reviewCourse(other, course.id)).rejects.toThrow('not found');
  });
});

describe('staff tools', () => {
  it('summarise applications for admins without sending contact details', async () => {
    const applicant = await person();
    const application = await getDb().instructorApplication.create({
      data: {
        userId: applicant.userId,
        fullName: 'Applicant Name',
        email: 'applicant@example.org',
        nationality: 'South Africa',
        phoneNumber: '+27 82 999 1234',
        expertise: 'Kirtan',
        experienceYears: 10,
        degree: 'None',
        workExperience: 'Temple musician',
        teachingExperience: 'Weekly classes',
        languages: 'English',
        motivation: 'To share kirtan',
        philosophy: 'Practice together',
        strengths: 'Patience',
      },
    });
    const admin = await person(['admin']);
    bedrock.results.push({
      summary: 'Experienced musician.',
      strengths: ['Ten years'],
      concerns: [],
      questions: ['Sample lesson?'],
    });
    expect((await summariseApplication(admin, application.id)).strengths).toEqual(['Ten years']);
    const prompt = JSON.stringify(bedrock.inputs[0].messages);
    expect(prompt).toContain('Temple musician');
    expect(prompt).not.toContain('+27 82 999 1234');
    expect(prompt).not.toContain('applicant@example.org');

    await expect(
      summariseApplication(await person(['instructor']), application.id),
    ).rejects.toThrow('Admins only');
  });

  it('draft support replies from the conversation and help articles', async () => {
    const learner = await person();
    const agent = await person(['support']);
    const ticket = await createTicket(learner, {
      category: 'ACCOUNT',
      subject: 'Forgot my password',
      body: 'I cannot log in.',
    });
    bedrock.results.push({ reply: 'Hi! Use Forgot password?', internalNote: '' });
    expect((await draftSupportReply(agent, ticket.number)).reply).toContain('Forgot password');
    const prompt = JSON.stringify(bedrock.inputs[0].messages);
    expect(prompt).toContain('I cannot log in.');
    expect(prompt).toContain('/help/resetting-your-password');
    await expect(draftSupportReply(learner, ticket.number)).rejects.toThrow('Support staff only');
  });
});

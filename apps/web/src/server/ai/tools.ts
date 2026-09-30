import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getArticle, searchHelp } from '@/lib/help';
import { hasRole, type Session } from '../auth/session';
import * as authoring from '../authoring';
import { getDb } from '../db';
import { rateLimit } from '../rate-limit';
import { getTicketForStaff } from '../support';
import { AiToolError, generateStructured, WRITING_RULES } from './structured';

// AI tools for each role. Every result is a draft a person reviews: practice questions for
// learners, outlines and details for instructors, summaries and reply drafts for staff.

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}...` : text);

async function perDay(session: Session, feature: string, limit: number) {
  const result = await rateLimit(`ai:${feature}:${session.userId}`, {
    limit,
    windowSeconds: 24 * 60 * 60,
  });
  if (!result.ok)
    throw new AiToolError(
      'invalid',
      'You have used this AI tool a lot today. Please try again tomorrow.',
    );
}

// ---- Learners: practice questions --------------------------------------------------------------

export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(5).max(300),
        options: z.array(z.string().min(1).max(200)).length(4),
        answer: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(500),
      }),
    )
    .min(3)
    .max(5),
});
export type Quiz = z.infer<typeof quizSchema>;

/** The lesson, if this person may read it (enrolled, free preview, its instructor or an admin). */
async function readableLesson(session: Session, lessonId: string) {
  const lesson = await getDb().lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  const course = lesson?.section.course;
  if (!lesson || !course || course.status !== 'PUBLISHED') return null;
  if (lesson.isPreview || hasRole(session, 'admin') || course.instructorId === session.userId)
    return lesson;
  const enrolled = await getDb().enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: course.id } },
  });
  return enrolled ? lesson : null;
}

/**
 * Practice questions for a lesson with text (a text lesson, or notes on a video or PDF).
 * Made once and shared; made again when the text changes or someone asks for new ones.
 */
export async function lessonQuiz(session: Session, lessonId: string, fresh = false): Promise<Quiz> {
  const lesson = await readableLesson(session, lessonId);
  if (!lesson) throw new AiToolError('invalid', 'Lesson not found.');
  const text = lesson.body?.trim() ?? '';
  if (text.length < 150) {
    throw new AiToolError(
      'invalid',
      'This lesson does not have enough text to make questions from yet.',
    );
  }
  const sourceKey = createHash('sha256').update(text).digest('hex').slice(0, 32);
  const cached = await getDb().lessonQuiz.findUnique({ where: { lessonId } });
  if (cached && cached.sourceKey === sourceKey && !fresh) {
    const parsed = quizSchema.safeParse({ questions: cached.questions });
    if (parsed.success) return parsed.data;
  }
  await perDay(session, 'lesson-quiz', 15);
  const quiz = await generateStructured({
    feature: 'lesson-helper',
    userId: session.userId,
    system: `${WRITING_RULES}
You write short practice quizzes that help learners remember and understand a lesson.`,
    prompt: `Write 4 multiple-choice questions about the lesson below. Each question has exactly 4 options, one correct answer (its index, 0 to 3) and a one or two sentence explanation that refers to the lesson. Ask only about what the lesson says; vary which option is correct.

Lesson: "${lesson.title}" in the course "${lesson.section.course.title}".
<material>
${clip(text, 12000)}
</material>`,
    schema: quizSchema,
    toolName: 'practice_quiz',
    toolDescription: 'Return the practice quiz.',
    maxTokens: 1500,
  });
  await getDb().lessonQuiz.upsert({
    where: { lessonId },
    create: { lessonId, questions: quiz.questions, sourceKey },
    update: { questions: quiz.questions, sourceKey },
  });
  return quiz;
}

// ---- Instructors: outline, details, pre-review check ------------------------------------------

export const outlineSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        lessons: z
          .array(
            z.object({
              title: z.string().min(1).max(150),
              type: z.enum(['VIDEO', 'PDF', 'TEXT']),
              summary: z.string().max(300),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(8),
  advice: z.string().max(800),
});
export type Outline = z.infer<typeof outlineSchema>;

const outlineBrief = z.object({
  about: z.string().trim().min(10).max(1500),
  audience: z.string().trim().max(300).optional(),
  size: z.enum(['short', 'medium', 'long']).default('medium'),
});
export type OutlineBrief = z.input<typeof outlineBrief>;

async function editableCourse(session: Session, courseId: string) {
  const course = await authoring.getCourseForEditing(session, courseId);
  if (course.status !== 'DRAFT' && !hasRole(session, 'admin')) {
    throw new AiToolError('invalid', 'Only drafts can be changed.');
  }
  return course;
}

function courseMaterial(
  course: Awaited<ReturnType<typeof authoring.getCourseForEditing>>,
  withText = false,
) {
  const lines = [
    `Title: ${course.title}`,
    `Category: ${course.category.name}`,
    `Level: ${course.level.toLowerCase()}`,
    `Subtitle: ${course.subtitle || '(none)'}`,
    `Description: ${course.description || '(none)'}`,
    `Outcomes: ${course.outcomes.length ? course.outcomes.join('; ') : '(none)'}`,
    `Free course: ${course.isFree ? 'yes' : 'no'}`,
    'Curriculum:',
    ...course.sections.flatMap((s, i) => [
      `${i + 1}. ${s.title}`,
      ...s.lessons.map(
        (l) =>
          `   - ${l.title} (${l.type.toLowerCase()}${l.isPreview ? ', free preview' : ''}${l.type !== 'TEXT' && !l.mediaKey ? ', file missing' : ''})${
            withText && l.body ? `\n     Text: ${clip(l.body.replace(/\s+/g, ' '), 1500)}` : ''
          }`,
      ),
    ]),
  ];
  return clip(lines.join('\n'), 30000);
}

export async function draftOutline(session: Session, courseId: string, input: OutlineBrief) {
  const brief = outlineBrief.parse(input);
  const course = await editableCourse(session, courseId);
  await perDay(session, 'course-outline', 10);
  const lessons = { short: '4 to 6', medium: '8 to 12', long: '14 to 20' }[brief.size];
  return generateStructured({
    feature: 'course-outline',
    userId: session.userId,
    system: `${WRITING_RULES}
You help instructors plan clear, well-paced online courses: short lessons, a logical order, a gentle start, and practical steps.`,
    prompt: `Suggest a course outline with ${lessons} lessons in total, grouped into sections. For each lesson give a title, the best format (VIDEO, PDF or TEXT) and a one-sentence summary. Then give brief advice (two or three sentences) for the instructor.

What the instructor wants to teach: ${brief.about}
Who it is for: ${brief.audience || 'not specified'}

The course so far:
<material>
${courseMaterial(course)}
</material>`,
    schema: outlineSchema,
    toolName: 'course_outline',
    toolDescription: 'Return the suggested outline.',
    maxTokens: 2500,
  });
}

/** Add an outline's sections and lessons to a draft (titles and formats; the instructor fills them in). */
export async function applyOutline(session: Session, courseId: string, outline: Outline) {
  const parsed = outlineSchema.parse(outline);
  await editableCourse(session, courseId);
  for (const section of parsed.sections) {
    await authoring.addSection(session, courseId, section.title);
    const updated = await authoring.getCourseForEditing(session, courseId);
    const created = updated.sections.at(-1)!;
    for (const lesson of section.lessons) {
      await authoring.addLesson(session, created.id, { title: lesson.title, type: lesson.type });
    }
  }
}

export const detailsSchema = z.object({
  subtitle: z.string().min(5).max(200),
  description: z.string().min(20).max(3000),
  outcomes: z.array(z.string().min(3).max(200)).min(3).max(8),
  notes: z.string().max(600),
});
export type DetailSuggestions = z.infer<typeof detailsSchema>;

export async function suggestDetails(session: Session, courseId: string) {
  const course = await editableCourse(session, courseId);
  await perDay(session, 'course-writing', 15);
  return generateStructured({
    feature: 'course-writing',
    userId: session.userId,
    system: `${WRITING_RULES}
You improve course pages so learners quickly understand what a course offers. Keep the instructor's meaning and voice; do not promise anything the course does not cover.`,
    prompt: `Suggest an improved subtitle (one sentence), description (two to four short paragraphs) and three to six learning outcomes (each starting with a verb) for this course, based on what is there. Add a short note explaining your main changes.

<material>
${courseMaterial(course, true)}
</material>`,
    schema: detailsSchema,
    toolName: 'course_details',
    toolDescription: 'Return the suggested course details.',
  });
}

export const reviewSchema = z.object({
  ready: z.boolean(),
  summary: z.string().max(800),
  suggestions: z
    .array(
      z.object({
        area: z.enum(['details', 'structure', 'content', 'accuracy', 'accessibility', 'tone']),
        severity: z.enum(['must', 'should', 'could']),
        detail: z.string().max(500),
      }),
    )
    .max(12),
});
export type CourseReview = z.infer<typeof reviewSchema>;

/** A second pair of eyes before review (for instructors) or during review (for admins). */
export async function reviewCourse(session: Session, courseId: string) {
  const course = await authoring.getCourseForEditing(session, courseId);
  await perDay(session, 'course-precheck', 15);
  const missing = authoring.reviewChecklist(course);
  return generateStructured({
    feature: 'course-precheck',
    userId: session.userId,
    system: `${WRITING_RULES}
You review online courses before they are published, like a careful editor: is the page clear, is the structure sensible, is the text accurate and respectful, is it accessible (for example, do videos have notes or transcripts)? Be specific and kind. Flag quotations or verse references that need checking against a source; never correct them from memory.`,
    prompt: `Review this course. Say whether it looks ready to publish, summarise its strengths and gaps in a few sentences, and list specific suggestions (must, should or could).
${missing.length ? `The platform's checklist already says these are missing: ${missing.join(' ')}` : ''}

<material>
${courseMaterial(course, true)}
</material>`,
    schema: reviewSchema,
    toolName: 'course_review',
    toolDescription: 'Return the review.',
    maxTokens: 2000,
  });
}

// ---- Staff: application summaries and reply drafts --------------------------------------------

export const applicationSummarySchema = z.object({
  summary: z.string().max(800),
  strengths: z.array(z.string().max(250)).max(6),
  concerns: z.array(z.string().max(250)).max(6),
  questions: z.array(z.string().max(250)).max(5),
});
export type ApplicationSummary = z.infer<typeof applicationSummarySchema>;

export async function summariseApplication(session: Session, applicationId: string) {
  if (!hasRole(session, 'admin')) throw new AiToolError('invalid', 'Admins only.');
  const application = await getDb().instructorApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new AiToolError('invalid', 'Application not found.');
  await perDay(session, 'application-summary', 30);
  const fields = [
    ['Expertise', application.expertise],
    ['Years of experience', String(application.experienceYears)],
    ['Degree', application.degree],
    ['Certifications', application.certifications ?? ''],
    ['Work experience', application.workExperience],
    ['Teaching experience', application.teachingExperience],
    ['Languages', application.languages],
    ['Motivation', application.motivation],
    ['Teaching philosophy', application.philosophy],
    ['Strengths', application.strengths],
  ];
  return generateStructured({
    feature: 'application-summary',
    userId: session.userId,
    system: `${WRITING_RULES}
You help admins review applications to teach. Summarise fairly and factually from what the applicant wrote; do not guess about the person or recommend a decision. Note where more information would help.`,
    prompt: `Summarise this application to teach, list strengths and open questions or concerns, and suggest questions the admin could ask.

<material>
${fields.map(([label, value]) => `${label}: ${clip(value, 2000)}`).join('\n')}
</material>`,
    schema: applicationSummarySchema,
    toolName: 'application_summary',
    toolDescription: 'Return the summary.',
  });
}

export const replyDraftSchema = z.object({
  reply: z.string().min(1).max(3000),
  internalNote: z.string().max(600),
});
export type ReplyDraft = z.infer<typeof replyDraftSchema>;

export async function draftSupportReply(session: Session, ticketNumber: number) {
  const ticket = await getTicketForStaff(session, ticketNumber);
  await perDay(session, 'support-draft', 60);
  const conversation = ticket.messages
    .map(
      (m) =>
        `${m.internal ? 'Staff note' : m.fromStaff ? 'Support' : 'Person'} (${m.authorName}): ${clip(m.body, 2000)}`,
    )
    .join('\n\n');
  const question = `${ticket.subject} ${ticket.messages.find((m) => !m.fromStaff)?.body ?? ''}`;
  const articles = searchHelp(question, { staff: false }, 3)
    .map((a) => getArticle(a.slug, { staff: false })!)
    .map((a) => `### ${a.title} (/help/${a.slug})\n${a.body}`)
    .join('\n\n');
  return generateStructured({
    feature: 'support-draft',
    role: 'assistant',
    userId: session.userId,
    system: `${WRITING_RULES}
You draft replies for the Living With Krishna support team. Be warm, brief and practical: answer the question, give steps and link to help articles with Markdown links to their paths. If staff need to do something (for example reset two-step verification), say so in the internal note instead of promising it. Address the person by first name.`,
    prompt: `Draft the next reply to this support request.

Request #${ticket.number}: ${ticket.subject} (category ${ticket.category.toLowerCase()}, from ${ticket.requester.name}${ticket.pageUrl ? `, about the page ${ticket.pageUrl}` : ''})
<material>
${clip(conversation, 12000)}
</material>

Help articles that may be relevant:
<material>
${articles || '(none found)'}
</material>`,
    schema: replyDraftSchema,
    toolName: 'reply_draft',
    toolDescription: 'Return the reply draft and a note for staff.',
    maxTokens: 1200,
  });
}

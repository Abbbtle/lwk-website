import 'server-only';
import { getDb } from './db';

// "Getting started" checklists: each step is worked out from what the person has actually done,
// so the list stays accurate without tracking clicks. People can hide a list once they know
// their way around.

export type ChecklistItem = { label: string; done: boolean; href: string; help?: string };
export type Checklist = { key: string; title: string; items: ChecklistItem[] };

export const CHECKLIST_KEYS = ['learner-start', 'instructor-start', 'admin-start'] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

async function dismissed(userId: string, key: ChecklistKey) {
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { dismissedTips: true },
  });
  return user?.dismissedTips.includes(key) ?? false;
}

/** Hides a checklist for good. */
export async function dismissChecklist(userId: string, key: ChecklistKey) {
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { dismissedTips: true },
  });
  if (!user || user.dismissedTips.includes(key)) return;
  await getDb().user.update({
    where: { id: userId },
    data: { dismissedTips: { push: key } },
  });
}

/** Null when hidden or every step is done. */
function visible(checklist: Checklist, hidden: boolean): Checklist | null {
  if (hidden || checklist.items.every((item) => item.done)) return null;
  return checklist;
}

export async function learnerChecklist(userId: string, mfaEnabled: boolean) {
  const db = getDb();
  const [hidden, enrollments, completedLessons, completedCourses] = await Promise.all([
    dismissed(userId, 'learner-start'),
    db.enrollment.count({ where: { userId } }),
    db.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    db.enrollment.count({ where: { userId, completedAt: { not: null } } }),
  ]);
  return visible(
    {
      key: 'learner-start',
      title: 'Getting started',
      items: [
        { label: 'Create your account', done: true, href: '/account' },
        {
          label: 'Enroll in a course (start with a free one)',
          done: enrollments > 0,
          href: '/explore?type=courses',
          help: 'enrolling-in-a-course',
        },
        {
          label: 'Complete your first lesson',
          done: completedLessons > 0,
          href: '/my-learning',
          help: 'using-the-lesson-player',
        },
        {
          label: 'Protect your account with two-step verification',
          done: mfaEnabled,
          href: '/account/security',
          help: 'two-step-verification',
        },
        { label: 'Finish a course', done: completedCourses > 0, href: '/my-learning' },
      ],
    },
    hidden,
  );
}

export async function instructorChecklist(userId: string) {
  const db = getDb();
  const [hidden, courses, lessons, covers, submitted, published] = await Promise.all([
    dismissed(userId, 'instructor-start'),
    db.course.count({ where: { instructorId: userId } }),
    db.lesson.count({ where: { section: { course: { instructorId: userId } } } }),
    db.course.count({ where: { instructorId: userId, coverKey: { not: null } } }),
    db.course.count({
      where: {
        instructorId: userId,
        OR: [{ status: 'IN_REVIEW' }, { publishedAt: { not: null } }],
      },
    }),
    db.course.count({ where: { instructorId: userId, status: 'PUBLISHED' } }),
  ]);
  return visible(
    {
      key: 'instructor-start',
      title: 'Your first course',
      items: [
        {
          label: 'Create a course',
          done: courses > 0,
          href: '/instructor',
          help: 'creating-a-course',
        },
        {
          label: 'Add sections and lessons',
          done: lessons > 0,
          href: '/instructor',
          help: 'creating-a-course',
        },
        {
          label: 'Add a cover image',
          done: covers > 0,
          href: '/instructor',
          help: 'uploading-videos-and-pdfs',
        },
        {
          label: 'Submit it for review',
          done: submitted > 0,
          href: '/instructor',
          help: 'submitting-for-review',
        },
        {
          label: 'Get published',
          done: published > 0,
          href: '/instructor',
          help: 'submitting-for-review',
        },
      ],
    },
    hidden,
  );
}

export async function adminChecklist(userId: string) {
  const db = getDb();
  const [hidden, supportStaff, resources, pendingApplications, reviewQueue] = await Promise.all([
    dismissed(userId, 'admin-start'),
    db.user.count({ where: { roles: { has: 'support' } } }),
    db.resource.count({ where: { status: 'PUBLISHED' } }),
    db.instructorApplication.count({ where: { status: 'PENDING' } }),
    db.course.count({ where: { status: 'IN_REVIEW' } }),
  ]);
  return visible(
    {
      key: 'admin-start',
      title: 'Setting up the platform',
      items: [
        { label: 'Turn on two-step verification', done: true, href: '/account/security' },
        {
          label: 'Add free content to Explore (or load the sample content for testing)',
          done: resources > 0,
          href: '/admin/explore',
          help: 'managing-free-content',
        },
        {
          label: 'Review waiting instructor applications',
          done: pendingApplications === 0,
          href: '/admin/applications',
        },
        {
          label: 'Review courses waiting for publication',
          done: reviewQueue === 0,
          href: '/admin/courses',
          help: 'reviewing-courses',
        },
        {
          label: 'Give someone the Support role to share support requests',
          done: supportStaff > 0,
          href: '/admin/users',
          help: 'managing-users-and-roles',
        },
      ],
    },
    hidden,
  );
}

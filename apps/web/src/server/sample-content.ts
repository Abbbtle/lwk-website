import 'server-only';
import type { CourseLevel, ResourceType } from '@/generated/prisma/client';
import { recordAudit } from './audit';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';

// Sample courses and free articles so testers can try enrolling, lessons and Explore before
// real content exists. Everything is marked as a sample (badges on cards and pages) and taught
// by "LWK Team", and admins remove it all in one step before launch.

const AUTHOR = 'LWK Team';
const NOTE =
  'This is a sample course used to test the platform. It will be replaced by courses from our instructors.';

type SampleLesson = { title: string; minutes: number; body: string };
type SampleCourse = {
  slug: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  level: CourseLevel;
  isFree: boolean;
  outcomes: string[];
  sections: { title: string; lessons: SampleLesson[] }[];
};

const courses: SampleCourse[] = [
  {
    slug: 'sample-kirtan-basics',
    category: 'kirtan',
    title: 'Kirtan Basics',
    subtitle: 'Sample course for testing: join your first kirtan with confidence.',
    description: `A short introduction to congregational chanting for newcomers.\n\n${NOTE}`,
    level: 'BEGINNER',
    isFree: true,
    outcomes: [
      'Understand what kirtan is and why devotees sing together',
      'Follow the call-and-response pattern of a kirtan',
      'Recognise the harmonium, mridanga and kartals',
      'Join your first kirtan with confidence',
    ],
    sections: [
      {
        title: 'What kirtan is',
        lessons: [
          {
            title: 'Singing together',
            minutes: 3,
            body: `Kirtan is the congregational singing of the holy names, accompanied by simple instruments. In the Gaudiya Vaishnava tradition it is one of the central practices of bhakti, and anyone can take part: no musical training is needed.

A kirtan leader sings a line and everyone answers with the same line. This call and response continues, often slowly at first and then faster, before settling again at the end.

**Try this:** listen to one kirtan from start to finish and notice how the tempo changes.`,
          },
          {
            title: 'The maha-mantra',
            minutes: 3,
            body: `Most kirtans in the Hare Krishna movement use the maha-mantra:

> Hare Krishna Hare Krishna Krishna Krishna Hare Hare
> Hare Rama Hare Rama Rama Rama Hare Hare

The same mantra is chanted quietly on beads in personal practice (japa). In kirtan it is sung aloud, together.

When you are new, simply repeat what the leader sings. The melodies become familiar after a few sessions.`,
          },
        ],
      },
      {
        title: 'Taking part',
        lessons: [
          {
            title: 'Instruments you will meet',
            minutes: 3,
            body: `- **Harmonium**: a small keyboard with bellows that carries the melody.
- **Mridanga**: a two-headed drum that keeps the rhythm.
- **Kartals**: small hand cymbals, usually played in a steady pattern.

If someone hands you kartals, keep them quiet and steady, and follow the drum rather than leading.`,
          },
          {
            title: 'Your first kirtan',
            minutes: 4,
            body: `1. Arrive a little early and sit where you can see the leader.
2. Put your phone away so you can give the singing your full attention.
3. Sing the response even if you are unsure of the words; the group carries you.
4. If the kirtan ends with a prayer or a bow, simply follow what others do.

Afterwards, thank the musicians. Many temples serve prasadam after kirtan, which is a good chance to meet people.`,
          },
        ],
      },
    ],
  },
  {
    slug: 'sample-prasadam-kitchen-basics',
    category: 'prasadam',
    title: 'Prasadam Kitchen Basics',
    subtitle: 'Sample course for testing: cook and offer a simple meal.',
    description: `Learn the standards of a devotional kitchen and cook a first simple offering.\n\n${NOTE}`,
    level: 'BEGINNER',
    isFree: false,
    outcomes: [
      'Explain what prasadam is',
      'Prepare your kitchen with care before cooking an offering',
      'Cook a simple jeera rice',
      'Offer food and honour prasadam respectfully',
    ],
    sections: [
      {
        title: 'Before you cook',
        lessons: [
          {
            title: 'What prasadam means',
            minutes: 3,
            body: `Prasadam means "mercy". It is vegetarian food cooked with devotion and offered to Krishna before it is eaten. Devotees follow a few simple standards: no meat, fish or eggs, and traditionally no onion or garlic.

The mood of cooking matters as much as the recipe: the cook thinks of pleasing Krishna rather than their own taste.`,
          },
          {
            title: 'Preparing your kitchen',
            minutes: 3,
            body: `- Clean the kitchen and wash your hands before you start.
- Keep the food you are cooking for the offering separate.
- Do not taste the food while cooking; the first taste is for Krishna.
- Use fresh ingredients and cook calmly.`,
          },
        ],
      },
      {
        title: 'A first recipe',
        lessons: [
          {
            title: 'Simple jeera rice',
            minutes: 5,
            body: `**Serves 4:** 1 cup basmati rice, 2 cups water, 1 tablespoon ghee, 1 teaspoon cumin seeds, half a teaspoon of salt.

1. Rinse the rice until the water runs clear, soak it for 15 minutes and drain.
2. Warm the ghee in a pot and add the cumin seeds. Let them sizzle for a few seconds.
3. Add the rice and stir gently for a minute so every grain is coated.
4. Add the water and salt, bring to the boil, then cover and simmer on low heat for 12 to 15 minutes.
5. Let the rice rest, covered, for five minutes before fluffing it with a fork.`,
          },
          {
            title: 'Offering and honouring prasadam',
            minutes: 3,
            body: `Place a portion of each preparation on a clean plate kept for offerings and set it before a picture of Krishna. Devotees then say the prayers they have been taught; if you are new, a sincere thank-you is a good beginning.

After the offering, the food is prasadam. Eat it gratefully, share it, and avoid wasting it.`,
          },
        ],
      },
    ],
  },
  {
    slug: 'sample-temple-etiquette',
    category: 'vaisnava-etiquette',
    title: 'Temple Etiquette for Newcomers',
    subtitle: 'Sample course for testing: feel at home on your first temple visit.',
    description: `What to expect when you visit a temple, and how to take part respectfully.\n\n${NOTE}`,
    level: 'BEGINNER',
    isFree: true,
    outcomes: [
      'Know what to expect on your first temple visit',
      'Greet devotees respectfully',
      'Take part in an arati',
      'Ask questions with confidence',
    ],
    sections: [
      {
        title: 'Arriving',
        lessons: [
          {
            title: 'Before you visit',
            minutes: 3,
            body: `Most temples welcome visitors every day. Dress modestly and comfortably; you will usually sit on the floor. Shoes are left at the entrance.

Check the temple's programme times. Sunday programmes often include kirtan, a talk and a vegetarian feast, which makes them a good first visit.`,
          },
          {
            title: 'Greeting others',
            minutes: 2,
            body: `Devotees greet each other with "Hare Krishna", often with palms joined. It is a greeting and a reminder of Krishna at the same time.

If you are not sure how to address someone, a warm "Hare Krishna" and your name is always welcome.`,
          },
        ],
      },
      {
        title: 'In the temple room',
        lessons: [
          {
            title: 'The arati ceremony',
            minutes: 3,
            body: `An arati is a ceremony in which lamps, incense and flowers are offered to the deities while everyone sings. You can simply watch and join the singing.

Towards the end, a lamp may be brought around. Devotees pass their hands over the flame and then touch their heads; follow what others do if you would like to take part.`,
          },
          {
            title: 'Asking questions',
            minutes: 2,
            body: `Questions are welcome. Senior devotees are usually happy to explain the philosophy, the deities or the daily programme. Ask after the programme rather than during the kirtan or the talk.

${NOTE}`,
          },
        ],
      },
    ],
  },
  {
    slug: 'sample-reading-the-bhagavad-gita',
    category: 'sastra-study',
    title: 'Reading the Bhagavad Gita: A First Look',
    subtitle: 'Sample course for testing: start reading the Gita with a steady habit.',
    description: `The setting and structure of the Bhagavad Gita, and how to read it day by day.\n\n${NOTE}`,
    level: 'BEGINNER',
    isFree: false,
    outcomes: [
      'Know the setting and structure of the Bhagavad Gita',
      'Read a verse with its translation and purport',
      'Build a steady daily reading habit',
    ],
    sections: [
      {
        title: 'Getting started',
        lessons: [
          {
            title: 'The setting',
            minutes: 3,
            body: `The Bhagavad Gita is a conversation between Krishna and the warrior Arjuna on the battlefield of Kurukshetra, recorded in the Mahabharata. It has 18 chapters and about 700 verses.

Arjuna is overwhelmed by doubt before the battle, and Krishna answers his questions about duty, the self and devotion.`,
          },
          {
            title: 'How a verse is presented',
            minutes: 4,
            body: `Editions used in the Hare Krishna movement, such as *Bhagavad-gita As It Is* by A.C. Bhaktivedanta Swami Prabhupada, present each verse in several parts:

1. The Sanskrit text.
2. A word-for-word meaning.
3. A translation.
4. A purport (explanation).

Read the translation first, then the purport, and note one idea to think about during the day.`,
          },
        ],
      },
      {
        title: 'Making it a habit',
        lessons: [
          {
            title: 'A daily reading habit',
            minutes: 3,
            body: `- Choose a regular time, such as early morning.
- Read a few verses slowly rather than many quickly.
- Keep a notebook for your questions.
- Discuss what you read with others; many temples hold weekly study groups.`,
          },
          {
            title: 'Where to go next',
            minutes: 2,
            body: `When you are ready, join a structured course taught by an experienced teacher, who can guide you chapter by chapter.

${NOTE}`,
          },
        ],
      },
    ],
  },
];

type SampleArticle = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  body: string;
};

const articles: SampleArticle[] = [
  {
    slug: 'sample-what-is-the-maha-mantra',
    category: 'kirtan',
    title: 'What is the Hare Krishna maha-mantra?',
    summary: 'A short introduction to the sixteen-word mantra at the heart of kirtan and japa.',
    body: `The maha-mantra ("great mantra") is a prayer of sixteen words, made of three names: Hare, Krishna and Rama.

> Hare Krishna Hare Krishna Krishna Krishna Hare Hare
> Hare Rama Hare Rama Rama Rama Hare Hare

## Two ways to chant

- **Kirtan**: singing the mantra together, usually with a leader and simple instruments.
- **Japa**: chanting it quietly on a string of 108 beads, one mantra for each bead.

## Starting out

Many people begin with one round of japa a day (108 mantras, about seven minutes). Chant clearly, listen to the sound, and gently bring your attention back when it wanders.

*Sample article for testing the platform.*`,
  },
  {
    slug: 'sample-five-tips-for-your-first-kirtan',
    category: 'kirtan',
    title: 'Five tips for your first kirtan',
    summary: 'Simple ways to relax, take part and enjoy congregational chanting.',
    body: `1. **Sit close enough to hear the leader.** Responding is easier when you can hear each line clearly.
2. **Sing, even quietly.** Nobody expects a perfect voice; kirtan is about taking part.
3. **Follow the tempo.** Kirtans often speed up and slow down again; let the drum guide you.
4. **Close your eyes if it helps.** Many people find it easier to focus on the sound.
5. **Stay for prasadam.** The meal afterwards is the best time to ask questions and meet people.

*Sample article for testing the platform.*`,
  },
  {
    slug: 'sample-halava-a-simple-sweet',
    category: 'prasadam',
    title: 'Halava: a simple sweet to offer',
    summary: 'A classic semolina pudding that is quick to cook and loved at every feast.',
    body: `## Ingredients (serves 6)

- 1 cup coarse semolina
- Half a cup of ghee or butter
- 1 cup sugar
- 2 and a half cups of water (or half water, half milk)
- A handful of raisins and a pinch of ground cardamom

## Method

1. Bring the water, sugar, raisins and cardamom to a simmer in a saucepan.
2. In a heavy pan, melt the ghee and toast the semolina over low heat, stirring, until golden and fragrant (about 10 minutes).
3. Standing back from the pan, slowly pour the hot syrup into the semolina while stirring; it will bubble up.
4. Keep stirring until the halava thickens and comes away from the sides.
5. Cover and rest for five minutes before offering.

*Sample article for testing the platform.*`,
  },
  {
    slug: 'sample-a-guide-to-the-sunday-feast',
    category: 'vaisnava-etiquette',
    title: "A newcomer's guide to the Sunday feast",
    summary: 'What happens at a temple Sunday programme, and how to feel at home.',
    body: `Many temples hold an open programme on Sunday afternoons. It usually has three parts:

1. **Kirtan**: congregational singing to begin.
2. **A talk**: often on a verse from the Bhagavad Gita or the Srimad Bhagavatam.
3. **The feast**: a vegetarian meal of prasadam shared by everyone.

## Tips

- Leave your shoes at the entrance and sit wherever there is space.
- Take the plate you are given and ask for more if you would like; guests are welcome to seconds.
- Stay afterwards to talk. Regular visitors are glad to answer questions.

*Sample article for testing the platform.*`,
  },
];

export function sampleContentAllowed() {
  return process.env.SAMPLE_CONTENT !== 'off';
}

function assertAllowed(session: Session) {
  if (!hasRole(session, 'admin')) throw new Error('Admins only.');
  if (!sampleContentAllowed()) throw new Error('Sample content is turned off here.');
}

export async function sampleContentStatus() {
  const [sampleCourses, sampleResources] = await Promise.all([
    getDb().course.count({ where: { isSample: true } }),
    getDb().resource.count({ where: { isSample: true } }),
  ]);
  return { courses: sampleCourses, resources: sampleResources };
}

/** Publish the sample courses and articles. Safe to run again: existing samples are replaced. */
export async function loadSampleContent(session: Session) {
  assertAllowed(session);
  const db = getDb();
  const categories = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const categoryId = (slug: string) => {
    const id = categories.get(slug);
    if (!id) throw new Error(`Category ${slug} is missing`);
    return id;
  };
  const now = new Date();

  await db.$transaction(async (tx) => {
    for (const course of courses) {
      // Replace a previous copy so its sections and lessons are rebuilt.
      await tx.course.deleteMany({ where: { slug: course.slug, isSample: true } });
      await tx.course.create({
        data: {
          slug: course.slug,
          title: course.title,
          subtitle: course.subtitle,
          description: course.description,
          outcomes: course.outcomes,
          level: course.level,
          status: 'PUBLISHED',
          instructorName: AUTHOR,
          isFree: course.isFree,
          isSample: true,
          publishedAt: now,
          categoryId: categoryId(course.category),
          sections: {
            create: course.sections.map((section, sectionIndex) => ({
              title: section.title,
              position: sectionIndex,
              lessons: {
                create: section.lessons.map((lesson, lessonIndex) => ({
                  title: lesson.title,
                  type: 'TEXT' as const,
                  body: lesson.body,
                  durationSeconds: lesson.minutes * 60,
                  position: lessonIndex,
                  // The first lesson of each course can be tried before enrolling.
                  isPreview: sectionIndex === 0 && lessonIndex === 0,
                })),
              },
            })),
          },
        },
      });
    }
    for (const article of articles) {
      await tx.resource.deleteMany({ where: { slug: article.slug, isSample: true } });
      await tx.resource.create({
        data: {
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          type: 'ARTICLE' satisfies ResourceType,
          body: article.body,
          authorName: AUTHOR,
          categoryId: categoryId(article.category),
          status: 'PUBLISHED',
          isSample: true,
          publishedAt: now,
        },
      });
    }
  });

  await recordAudit(
    { userId: session.userId, name: session.name },
    {
      action: 'sample.loaded',
      target: { type: 'site' },
      summary: `Loaded sample content (${courses.length} courses, ${articles.length} articles)`,
    },
  );
}

/** Remove every sample course (with its enrollments and progress) and sample resource. */
export async function removeSampleContent(session: Session) {
  assertAllowed(session);
  const db = getDb();
  const [removedCourses, removedResources] = await db.$transaction([
    db.course.deleteMany({ where: { isSample: true } }),
    db.resource.deleteMany({ where: { isSample: true } }),
  ]);
  await recordAudit(
    { userId: session.userId, name: session.name },
    {
      action: 'sample.removed',
      target: { type: 'site' },
      summary: `Removed sample content (${removedCourses.count} courses, ${removedResources.count} resources)`,
    },
  );
  return { courses: removedCourses.count, resources: removedResources.count };
}

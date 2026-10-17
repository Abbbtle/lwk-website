// Sample catalogue based on the reference POC, loaded by prisma/seed.ts.
import type { Category, Course, Level, Section } from '../src/lib/catalog/types';

export const categories: Category[] = [
  {
    slug: 'kirtan',
    name: 'Kirtan',
    headline: 'Rediscover Kirtan',
    description:
      'Learn to sing and lead the holy names with harmonium, mridanga and kartals, from first melodies to leading a full kirtan.',
  },
  {
    slug: 'prasadam',
    name: 'Prasadam',
    headline: 'Rediscover Prasadam',
    description:
      'Cook sanctified vegetarian food with devotion, from everyday meals to festival feasts offered to Krishna.',
  },
  {
    slug: 'vaisnava-etiquette',
    name: 'Vaisnava Etiquette',
    headline: 'Rediscover Etiquette',
    description:
      'Understand the mood and manners of devotional life, at home, in the temple and in the association of devotees.',
  },
  {
    slug: 'sastra-study',
    name: 'Sastra Study',
    headline: 'Rediscover Sastra',
    description:
      'Study the Bhagavad-gita, Upanishads and Vedic literature systematically, with guidance on applying their wisdom.',
  },
];

const faculty: Record<string, string> = {
  kirtan: 'LWK Kirtan Faculty',
  prasadam: 'LWK Prasadam Kitchen',
  'vaisnava-etiquette': 'LWK Vaisnava Culture Team',
  'sastra-study': 'LWK Sastra Faculty',
};

function course(
  categorySlug: string,
  slug: string,
  title: string,
  level: Level,
  subtitle: string,
  outcomes: string[],
  sections: [string, number, number][],
): Course {
  return {
    slug,
    title,
    subtitle,
    description: `${subtitle} This course is taught in short, practical lessons you can follow at home, at your own pace.`,
    categorySlug,
    instructor: faculty[categorySlug],
    level,
    priceUsd: 30,
    outcomes,
    sections: sections.map(([sectionTitle, lessonCount, durationMinutes]): Section => ({
      title: sectionTitle,
      lessonCount,
      durationMinutes,
    })),
  };
}

export const courses: Course[] = [
  course(
    'kirtan',
    'kirtan-basics',
    'Kirtan Basics',
    'Beginner',
    'Start singing the holy names with confidence, even if you have never sung before.',
    [
      'Sing the Hare Krishna maha-mantra in simple melodies',
      'Follow call-and-response with a group',
      'Keep a steady beat with kartals',
    ],
    [
      ['What kirtan is and why we sing', 3, 25],
      ['Your first melodies', 5, 50],
      ['Keeping time with kartals', 4, 40],
      ['Joining a group kirtan', 3, 30],
    ],
  ),
  course(
    'kirtan',
    'mastering-harmonium',
    'Mastering Harmonium',
    'Intermediate',
    'Accompany kirtan on the harmonium, from finding the drone to playing full melodies.',
    [
      'Play drones, chords and melodies for common kirtan tunes',
      'Transpose a melody to suit the leader',
      'Practise with a structured daily routine',
    ],
    [
      ['Getting to know the harmonium', 4, 35],
      ['Drones and basic chords', 6, 60],
      ['Playing the melody', 6, 70],
      ['Accompanying a leader', 4, 45],
    ],
  ),
  course(
    'kirtan',
    'advanced-kirtan-techniques',
    'Advanced Kirtan Techniques',
    'Advanced',
    'Refine tempo changes, ornamentation and dynamics to deepen the kirtan experience.',
    [
      'Build and release energy through tempo',
      'Use ornamentation tastefully',
      'Coordinate with mridanga and kartal players',
    ],
    [
      ['Tempo and dynamics', 5, 55],
      ['Ornamentation', 5, 50],
      ['Playing as an ensemble', 4, 45],
    ],
  ),
  course(
    'kirtan',
    'history-of-kirtan',
    'History of Kirtan',
    'Beginner',
    'Trace the tradition of congregational chanting from the scriptures to the present day.',
    [
      'Explain the scriptural basis of sankirtana',
      'Describe how kirtan spread around the world',
      'Recognise the main kirtan styles',
    ],
    [
      ['Kirtan in the scriptures', 4, 40],
      ['The sankirtana movement', 4, 45],
      ['Kirtan around the world', 3, 30],
    ],
  ),
  course(
    'kirtan',
    'kirtan-leadership',
    'Kirtan Leadership',
    'Advanced',
    'Lead kirtan for temple programs and gatherings with the right mood and musicianship.',
    [
      'Choose melodies suited to the occasion',
      'Guide the energy of a group',
      'Lead with humility and attentiveness',
    ],
    [
      ['The mood of a kirtan leader', 3, 30],
      ['Choosing and pacing melodies', 5, 50],
      ['Leading in different settings', 4, 40],
    ],
  ),
  course(
    'prasadam',
    'prasadam-cooking',
    'Prasadam Cooking',
    'Beginner',
    'Learn the principles of cooking for Krishna and prepare a complete offering.',
    [
      'Understand the standards of cooking for offering',
      'Cook rice, dal, sabji and chapati',
      'Offer food with the proper prayers',
    ],
    [
      ['Cooking as devotion', 3, 25],
      ['Kitchen standards', 3, 30],
      ['A complete lunch offering', 6, 90],
      ['Offering and honouring prasadam', 2, 20],
    ],
  ),
  course(
    'prasadam',
    'vegetarian-delights',
    'Vegetarian Delights',
    'Beginner',
    'Cook colourful vegetarian dishes that are simple enough for every day.',
    ['Cook ten versatile vegetarian recipes', 'Balance spices and textures', 'Plan a weekly menu'],
    [
      ['Spices and the vegetarian pantry', 4, 35],
      ['Everyday main dishes', 6, 80],
      ['Sides, chutneys and sweets', 5, 60],
    ],
  ),
  course(
    'prasadam',
    'ayurvedic-recipes',
    'Ayurvedic Recipes',
    'Intermediate',
    'Prepare nourishing meals guided by the principles of Ayurveda.',
    [
      'Understand the basics of the three doshas',
      'Cook seasonal, balancing meals',
      'Use spices for digestion and wellbeing',
    ],
    [
      ['Ayurveda in the kitchen', 4, 40],
      ['Seasonal cooking', 5, 65],
      ['Healing spices and teas', 4, 40],
    ],
  ),
  course(
    'prasadam',
    'healthy-cooking',
    'Healthy Cooking',
    'Beginner',
    'Cook wholesome, satisfying prasadam with less oil and sugar.',
    [
      'Adapt favourite recipes to be lighter',
      'Cook balanced, protein-rich meals',
      'Prepare healthy snacks and sweets',
    ],
    [
      ['Principles of healthy cooking', 3, 30],
      ['Lighter main dishes', 5, 60],
      ['Healthy snacks and sweets', 4, 45],
    ],
  ),
  course(
    'prasadam',
    'spiritual-meals',
    'Spiritual Meals',
    'Intermediate',
    'Prepare festival feasts and special offerings for holy days.',
    ['Plan a festival menu', 'Cook for large gatherings', 'Prepare traditional festival sweets'],
    [
      ['Festival calendar and menus', 3, 30],
      ['Cooking for many', 5, 70],
      ['Traditional sweets', 5, 65],
    ],
  ),
  course(
    'vaisnava-etiquette',
    'intro-to-vaisnava-etiquette',
    'Intro to Vaisnava Etiquette',
    'Beginner',
    'Learn the basic courtesies of devotional life and the reasons behind them.',
    [
      'Greet and address devotees appropriately',
      'Understand the principle of humility',
      'Avoid common offences',
    ],
    [
      ['Why etiquette matters', 3, 25],
      ['Greetings and forms of address', 4, 35],
      ['Avoiding offences', 4, 40],
    ],
  ),
  course(
    'vaisnava-etiquette',
    'respect-and-devotion',
    'Respect and Devotion',
    'Beginner',
    'Cultivate respectful relationships with devotees, teachers and family.',
    [
      'Show respect in word and action',
      'Serve senior devotees and guests',
      'Resolve disagreements gracefully',
    ],
    [
      ['The mood of respect', 3, 30],
      ['Serving others', 4, 40],
      ['Harmony in community', 4, 40],
    ],
  ),
  course(
    'vaisnava-etiquette',
    'daily-devotional-practices',
    'Daily Devotional Practices',
    'Beginner',
    'Build a steady daily routine of chanting, study and worship at home.',
    ['Establish a morning program', 'Chant japa attentively', 'Set up and care for a home altar'],
    [
      ['A day in devotional life', 3, 25],
      ['Japa and morning program', 5, 50],
      ['The home altar', 4, 45],
    ],
  ),
  course(
    'vaisnava-etiquette',
    'advanced-vaisnava-manners',
    'Advanced Vaisnava Manners',
    'Advanced',
    'Go deeper into the etiquette of service, leadership and hosting.',
    [
      'Host visiting devotees and sannyasis',
      'Serve in leadership with humility',
      'Understand subtle offences and how to avoid them',
    ],
    [
      ['Hosting and hospitality', 4, 40],
      ['Etiquette in leadership', 4, 45],
      ['Subtle offences', 4, 40],
    ],
  ),
  course(
    'vaisnava-etiquette',
    'etiquette-in-the-temple',
    'Etiquette in the Temple',
    'Beginner',
    'Visit and serve in the temple with confidence and respect.',
    [
      'Offer obeisances and greet the Deities',
      'Participate in aratis and programs',
      'Serve in the temple respectfully',
    ],
    [
      ['Entering the temple', 3, 25],
      ['Aratis and programs', 4, 40],
      ['Temple service', 4, 35],
    ],
  ),
  course(
    'sastra-study',
    'bhagavad-gita-deep-dive',
    'Bhagavad Gita Deep Dive',
    'Intermediate',
    'Study the Bhagavad-gita chapter by chapter and apply its teachings to daily life.',
    [
      'Explain the main themes of each chapter',
      'Understand karma, jnana and bhakti yoga',
      'Apply the Gita to modern challenges',
    ],
    [
      ['Setting the scene: chapters 1-2', 6, 80],
      ['Action and knowledge: chapters 3-6', 8, 110],
      ['Devotion: chapters 7-12', 10, 140],
      ['Conclusions: chapters 13-18', 10, 140],
    ],
  ),
  course(
    'sastra-study',
    'upanishads-study',
    'Upanishads Study',
    'Advanced',
    'Explore the principal Upanishads and their teachings on the self and the Absolute.',
    [
      'Summarise the principal Upanishads',
      'Understand the nature of the self',
      'Relate the Upanishads to bhakti',
    ],
    [
      ['Introduction to the Upanishads', 4, 45],
      ['Isopanisad', 6, 80],
      ['Other principal Upanishads', 6, 85],
    ],
  ),
  course(
    'sastra-study',
    'vedic-literature-overview',
    'Vedic Literature Overview',
    'Beginner',
    'Get a map of the Vedic literature and how its parts fit together.',
    [
      'Name the main divisions of the Vedic literature',
      'Understand the role of the Puranas and Itihasas',
      'Know where to begin your own study',
    ],
    [
      ['The Vedas and Upanishads', 4, 40],
      ['Puranas and Itihasas', 4, 45],
      ['How to study sastra', 3, 30],
    ],
  ),
  course(
    'sastra-study',
    'sacred-texts-mastery',
    'Sacred Texts Mastery',
    'Advanced',
    'Develop the skills to study, memorise and present sastra to others.',
    [
      'Memorise and recite verses',
      'Prepare and give a class',
      'Research answers in the scriptures',
    ],
    [
      ['Memorising verses', 4, 45],
      ['Preparing a class', 5, 60],
      ['Research and presentation', 4, 50],
    ],
  ),
  course(
    'sastra-study',
    'philosophy-of-bhakti',
    'Philosophy of Bhakti',
    'Intermediate',
    'Understand the philosophy of devotional service and its stages of development.',
    [
      'Describe the stages of bhakti',
      'Understand sadhana and its purpose',
      'Relate philosophy to practice',
    ],
    [
      ['What is bhakti?', 4, 40],
      ['Sadhana bhakti', 5, 55],
      ['The stages of devotion', 5, 60],
    ],
  ),
];

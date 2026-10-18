// Single courses are priced in five tiers rather than at any amount: instructors choose how
// substantial a course is, and each tier has a fair price in every region (see prices.ts).

export const COURSE_TIERS = [1, 2, 3, 4, 5] as const;
export type CourseTier = (typeof COURSE_TIERS)[number];

const tierNames: Record<CourseTier, string> = {
  1: 'Short (under 2 hours)',
  2: 'Standard',
  3: 'Full course',
  4: 'In-depth',
  5: 'Major programme',
};

/** "Standard", "Major programme". */
export function courseTierName(tier: CourseTier): string {
  return tierNames[tier];
}

/** "Tier 2 · Standard". */
export function courseTierTitle(tier: CourseTier): string {
  return `Tier ${tier} · ${courseTierName(tier)}`;
}

export function isCourseTier(value: unknown): value is CourseTier {
  return COURSE_TIERS.some((tier) => tier === value);
}

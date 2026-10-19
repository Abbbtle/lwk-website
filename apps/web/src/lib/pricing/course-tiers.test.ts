import { describe, expect, it } from 'vitest';
import { COURSE_TIERS, courseTierName, courseTierTitle, isCourseTier } from './course-tiers';

describe('course tiers', () => {
  it('are numbered 1 to 5, each with a name', () => {
    expect(COURSE_TIERS.map((tier) => courseTierName(tier))).toEqual([
      'Short (under 2 hours)',
      'Standard',
      'Full course',
      'In-depth',
      'Major programme',
    ]);
    expect(courseTierTitle(2)).toBe('Tier 2 · Standard');
  });

  it('recognises tiers and nothing else', () => {
    expect(COURSE_TIERS.every((tier) => isCourseTier(tier))).toBe(true);
    for (const value of [0, 6, 2.5, '2', null, undefined]) {
      expect(isCourseTier(value), String(value)).toBe(false);
    }
  });
});

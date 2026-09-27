import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './safe-redirect';

describe('safeReturnTo', () => {
  it('keeps paths on this site, including query and hash', () => {
    expect(safeReturnTo('/courses/kirtan-basics')).toBe('/courses/kirtan-basics');
    expect(safeReturnTo('/explore?q=gita#top')).toBe('/explore?q=gita#top');
  });

  it('falls back for missing values and anything that could leave the site', () => {
    for (const value of [
      null,
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'courses',
    ]) {
      expect(safeReturnTo(value)).toBe('/');
    }
    expect(safeReturnTo('//evil.example', '/my-learning')).toBe('/my-learning');
  });
});

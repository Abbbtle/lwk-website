import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readingMinutes } from '@/lib/format';
import { parseBlocks, RichText, safeHref } from './rich-text';

const html = (text: string) => renderToStaticMarkup(<RichText text={text} />);

describe('RichText', () => {
  it('renders the supported Markdown subset', () => {
    const out = html(
      '## Heading\n\nA **bold** and *soft* word with `code`.\nNext line.\n\n- one\n- two\n\n1. first\n2. second\n\n> A quote',
    );
    expect(out).toContain('<h3');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>soft</em>');
    expect(out).toContain('code</code>');
    expect(out).toContain('<br/>Next line.');
    expect(out).toMatch(/<ul[^>]*><li>one<\/li><li>two<\/li><\/ul>/);
    expect(out).toMatch(/<ol[^>]*><li>first<\/li>/);
    expect(out).toContain('<blockquote');
  });

  it('never outputs HTML from the text', () => {
    const out = html('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('only links to web addresses and site paths', () => {
    expect(html('[site](/courses)')).toContain('href="/courses"');
    expect(html('[web](https://example.org/a)')).toContain('rel="noopener noreferrer nofollow"');
    const blocked = html('[click](javascript:alert(1))');
    expect(blocked).not.toContain('href');
    expect(blocked).toContain('click');
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });

  it('keeps plain text lessons looking as before', () => {
    expect(parseBlocks('First paragraph.\n\nSecond one.')).toEqual([
      { kind: 'paragraph', lines: ['First paragraph.'] },
      { kind: 'paragraph', lines: ['Second one.'] },
    ]);
  });

  it('estimates reading time', () => {
    expect(readingMinutes('word '.repeat(600))).toBe(3);
    expect(readingMinutes('')).toBe(1);
  });
});

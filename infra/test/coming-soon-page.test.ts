import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// lwk-coming-soon serves the page with a strict content security policy (styles, images and fonts
// from the site only; no scripts or inline styles). The page is published from main without a
// stack deploy, so it has to keep to that policy on its own.
const pageDir = join(__dirname, '..', 'coming-soon');
const html = readdirSync(pageDir)
  .filter((file) => file.endsWith('.html'))
  .map((file) => [file, readFileSync(join(pageDir, file), 'utf8')] as const);
const css = readFileSync(join(pageDir, 'styles.css'), 'utf8');

describe('coming-soon page and its content security policy', () => {
  it('has an index.html, which is also the 404 page', () => {
    assert.ok(html.some(([file]) => file === 'index.html'));
  });

  for (const [file, source] of html) {
    it(`${file} has no scripts or inline styles`, () => {
      assert.doesNotMatch(source, /<script/i);
      assert.doesNotMatch(source, /\sstyle\s*=/i);
      assert.doesNotMatch(source, /<style/i);
    });

    it(`${file} loads stylesheets, icons, fonts and images from the site only`, () => {
      const links = [...source.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag);
      for (const tag of links) {
        if (!/rel="(stylesheet|preload|icon)"/.test(tag)) continue;
        assert.match(tag, /href="\/[^/]/, tag);
      }
      for (const [, src] of source.matchAll(/\ssrc="([^"]*)"/gi)) {
        assert.match(src, /^\/[^/]/, src);
      }
    });
  }

  it('styles.css loads fonts and images from the site only', () => {
    for (const [, url] of css.matchAll(/url\(\s*['"]?([^'")]+)/gi)) {
      assert.match(url, /^\/[^/]/, url);
    }
  });
});

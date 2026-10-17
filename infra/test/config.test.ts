import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { appOrigins, siteUrl, stages, type StageConfig } from '../lib/config';

const dev = stages.dev;

function withExtraOrigins(extraAppOrigins: string[]): StageConfig {
  return { ...dev, extraAppOrigins };
}

describe('stage addresses', () => {
  it('derives the site URL from the host name', () => {
    assert.equal(siteUrl(dev), 'https://dev.livingwithkrishna.com');
  });

  it('allows the site first, then the extra origins', () => {
    assert.deepEqual(appOrigins(withExtraOrigins(['http://localhost:3000'])), [
      'https://dev.livingwithkrishna.com',
      'http://localhost:3000',
    ]);
  });

  for (const invalid of [
    'https://uat.livingwithkrishna.com/',
    'https://x.example/app',
    'localhost',
  ]) {
    it(`rejects ${JSON.stringify(invalid)} as an extra origin`, () => {
      assert.throws(() => appOrigins(withExtraOrigins([invalid])), /must be bare origins/);
    });
  }

  it('accepts the configured stages', () => {
    for (const stage of Object.values(stages)) assert.ok(appOrigins(stage).length > 0);
  });
});

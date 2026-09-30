import { describe, expect, it } from 'vitest';
import { costMicros, priceFor } from './pricing';

describe('AI pricing', () => {
  it('prices the configured models from the published list', () => {
    expect(priceFor('global.anthropic.claude-haiku-4-5-20251001-v1:0').output).toBe(5);
    expect(priceFor('global.anthropic.claude-sonnet-5').input).toBe(2);
    expect(priceFor('global.anthropic.claude-sonnet-5-5').input).toBe(2);
    expect(priceFor('global.anthropic.claude-opus-5-5').output).toBe(20);
  });

  it('costs a call in micro-dollars, never underestimating unknown models', () => {
    // 2,000 input + 1,000 cache read + 300 output on Haiku 4.5.
    expect(
      costMicros('anthropic.claude-haiku-4-5', {
        inputTokens: 2000,
        cacheReadTokens: 1000,
        cacheWriteTokens: 0,
        outputTokens: 300,
      }),
    ).toBe(2000 + 100 + 1500);
    expect(priceFor('some-new-model').output).toBe(50);
  });
});

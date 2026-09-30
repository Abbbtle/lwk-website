// Estimated cost of a model call, for the monthly cap. Prices are USD per million tokens for
// global inference profiles on Amazon Bedrock (the standard list prices; regional profiles
// cost 10% more). Source: Anthropic's pricing page, checked 2026-09-30.

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type Price = { input: number; cacheWrite: number; cacheRead: number; output: number };

// Most specific pattern first.
const PRICES: [pattern: string, price: Price][] = [
  ['haiku-4-5', { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 }],
  ['sonnet-5', { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 }],
  ['sonnet-4', { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 }],
  ['opus-5-5', { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 }],
  ['opus', { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 }],
  ['fable', { input: 10, cacheWrite: 12.5, cacheRead: 0.25, output: 50 }],
];
// An unknown model is costed at the highest price, so the cap is never underestimated.
const FALLBACK: Price = { input: 10, cacheWrite: 12.5, cacheRead: 1, output: 50 };

export function priceFor(model: string): Price {
  return PRICES.find(([pattern]) => model.includes(pattern))?.[1] ?? FALLBACK;
}

/** Cost in millionths of a US dollar, rounded up. */
export function costMicros(model: string, usage: TokenUsage): number {
  const price = priceFor(model);
  // Price per million tokens equals micro-dollars per token.
  const micros =
    usage.inputTokens * price.input +
    usage.cacheWriteTokens * price.cacheWrite +
    usage.cacheReadTokens * price.cacheRead +
    usage.outputTokens * price.output;
  return Math.ceil(micros);
}

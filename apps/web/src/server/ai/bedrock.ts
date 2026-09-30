import 'server-only';
import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConverseStreamCommand,
  type Message,
  type SystemContentBlock,
  type Tool,
  type ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { aiConfig } from './config';
import type { TokenUsage } from './pricing';

// Claude on Amazon Bedrock through the Converse API, called with the server's own AWS
// credentials (instance role), so there are no API keys to manage.

export class AiUnavailableError extends Error {}

let client: BedrockRuntimeClient | undefined;
function bedrock() {
  client ??= new BedrockRuntimeClient({ region: aiConfig().region, maxAttempts: 2 });
  return client;
}

// After an error that will not go away by itself (no model access, zero quota), stop calling
// Bedrock for a while so people get the non-AI fallback at once instead of waiting.
let unavailableUntil = 0;

export function aiAvailable() {
  return aiConfig().enabled && Date.now() >= unavailableUntil;
}

/** For tests. */
export function resetAiCircuit() {
  unavailableUntil = 0;
}

function explain(error: unknown): never {
  const name = (error as { name?: string })?.name ?? '';
  const message = (error as Error)?.message ?? String(error);
  if (
    /AccessDenied|ResourceNotFound|UnrecognizedClient|ExpiredToken|Credentials/i.test(
      name + message,
    )
  ) {
    unavailableUntil = Date.now() + 10 * 60_000;
    console.error('AI model access failed', name, message);
    throw new AiUnavailableError(message);
  }
  if (/Throttling|ServiceUnavailable|TooManyRequests/i.test(name)) {
    unavailableUntil = Date.now() + 2 * 60_000;
    console.error('AI model busy (call failed)', name, message);
    throw new AiUnavailableError(message);
  }
  throw error;
}

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type StreamEvent =
  | { type: 'text'; text: string }
  | {
      type: 'done';
      stopReason: string;
      message: Message;
      toolCalls: ToolCall[];
      usage: TokenUsage;
    };

/**
 * One model turn, streamed. Yields text as it arrives, then the complete assistant message
 * (with any tool calls) and the token usage.
 */
export async function* converseStream({
  model,
  system,
  messages,
  tools,
  forceTool,
  maxTokens = 800,
  temperature = 0.3,
}: {
  model: string;
  system: string;
  messages: Message[];
  tools?: Tool[];
  /** Make the model answer by calling this tool (structured output). */
  forceTool?: string;
  maxTokens?: number;
  temperature?: number;
}): AsyncGenerator<StreamEvent> {
  if (!aiAvailable()) throw new AiUnavailableError('AI is switched off or resting');

  // The system prompt (and tool list) rarely change, so mark them for prompt caching.
  const systemBlocks: SystemContentBlock[] = [
    { text: system },
    { cachePoint: { type: 'default' } },
  ];
  let response;
  try {
    response = await bedrock().send(
      new ConverseStreamCommand({
        modelId: model,
        system: systemBlocks,
        messages,
        inferenceConfig: { maxTokens, temperature },
        ...(tools?.length && {
          toolConfig: {
            tools: [...tools, { cachePoint: { type: 'default' } }],
            ...(forceTool && { toolChoice: { tool: { name: forceTool } } }),
          },
        }),
      }),
    );
  } catch (error) {
    explain(error);
  }

  const blocks: { text?: string; toolUse?: { id: string; name: string; json: string } }[] = [];
  let stopReason = 'end_turn';
  const usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  try {
    for await (const event of response.stream ?? []) {
      if (event.contentBlockStart?.start?.toolUse) {
        const { toolUseId, name } = event.contentBlockStart.start.toolUse;
        blocks[event.contentBlockStart.contentBlockIndex ?? blocks.length] = {
          toolUse: { id: toolUseId ?? '', name: name ?? '', json: '' },
        };
      } else if (event.contentBlockDelta) {
        const index = event.contentBlockDelta.contentBlockIndex ?? 0;
        const delta = event.contentBlockDelta.delta;
        if (delta?.text) {
          blocks[index] ??= { text: '' };
          blocks[index].text = (blocks[index].text ?? '') + delta.text;
          yield { type: 'text', text: delta.text };
        } else if (delta?.toolUse?.input !== undefined) {
          const block = (blocks[index] ??= { toolUse: { id: '', name: '', json: '' } });
          if (block.toolUse) block.toolUse.json += delta.toolUse.input;
        }
      } else if (event.messageStop) {
        stopReason = event.messageStop.stopReason ?? stopReason;
      } else if (event.metadata?.usage) {
        const u = event.metadata.usage;
        usage.inputTokens = u.inputTokens ?? 0;
        usage.outputTokens = u.outputTokens ?? 0;
        usage.cacheReadTokens = u.cacheReadInputTokens ?? 0;
        usage.cacheWriteTokens = u.cacheWriteInputTokens ?? 0;
      } else {
        const failure =
          event.throttlingException ??
          event.serviceUnavailableException ??
          event.internalServerException ??
          event.modelStreamErrorException ??
          event.validationException;
        if (failure) throw failure;
      }
    }
  } catch (error) {
    explain(error);
  }

  const toolCalls: ToolCall[] = [];
  const content: ContentBlock[] = [];
  for (const block of blocks.filter(Boolean)) {
    if (block.toolUse) {
      let input: Record<string, unknown> = {};
      try {
        input = block.toolUse.json ? JSON.parse(block.toolUse.json) : {};
      } catch {
        // A malformed call is answered with an error result below.
      }
      toolCalls.push({ id: block.toolUse.id, name: block.toolUse.name, input });
      content.push({
        toolUse: {
          toolUseId: block.toolUse.id,
          name: block.toolUse.name,
          input: input as ToolUseBlock['input'],
        },
      });
    } else if (block.text) {
      content.push({ text: block.text });
    }
  }
  yield {
    type: 'done',
    stopReason,
    message: { role: 'assistant', content },
    toolCalls,
    usage,
  };
}

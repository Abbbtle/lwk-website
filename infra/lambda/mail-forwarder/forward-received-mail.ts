import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import {
  prepareForwardedMessage,
  reasonNotToForward,
  sendingAddress,
  type SesReceipt,
  type SkipReason,
} from './forwarding-rules';
import type { ForwarderSettings } from './settings';

/** The part of the event an SES receipt rule's Lambda action sends that forwarding uses. */
export type SesReceivingEvent = {
  Records: { ses: { mail: { messageId: string }; receipt: SesReceipt } }[];
};

/**
 * What happened to one received message, logged once per message so that the logs can be counted
 * by status. It never holds an address or any content.
 */
export type ForwardingOutcome =
  | { messageId: string; status: 'forwarded' }
  | { messageId: string; status: 'skipped'; reason: SkipReason }
  | { messageId: string; status: 'failed'; errorName: string };

/** The settings and the AWS calls the forwarder uses, passed in so it can be tested without AWS. */
export type ForwarderDependencies = {
  settings: ForwarderSettings;
  /** Reads a stored message from the message bucket, by S3 key. */
  readMessage(key: string): Promise<Uint8Array>;
  /** Sends a forwarded copy with SES. */
  sendEmail(request: SendEmailCommandInput): Promise<void>;
  log(outcome: ForwardingOutcome): void;
};

/**
 * Forwards the messages of one SES receiving event. Each message is logged once, by SES message ID,
 * with what happened to it. A failure is logged by the error's name only (SES error messages can
 * contain addresses) and then rethrown without its cause, so Lambda retries the event and finally
 * reports it to the stack's failure topic.
 */
export async function forwardReceivedMail(
  event: SesReceivingEvent,
  dependencies: ForwarderDependencies,
): Promise<void> {
  for (const { ses: received } of event.Records) {
    const { messageId } = received.mail;
    const reason = reasonNotToForward(received.receipt);
    if (reason) {
      dependencies.log({ messageId, status: 'skipped', reason });
      continue;
    }
    try {
      await forward(messageId, received.receipt.recipients, dependencies);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      dependencies.log({ messageId, status: 'failed', errorName });
      throw new Error(`Forwarding ${messageId} failed (${errorName})`);
    }
    dependencies.log({ messageId, status: 'forwarded' });
  }
}

async function forward(
  messageId: string,
  recipients: readonly string[],
  { settings, readMessage, sendEmail }: ForwarderDependencies,
): Promise<void> {
  const received = await readMessage(settings.messageKeyPrefix + messageId);
  const fromAddress = sendingAddress(recipients, settings.forwardedAddresses);
  const message = prepareForwardedMessage(received, {
    fromAddress,
    forwarderName: settings.forwarderName,
  });
  await sendEmail({
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: [settings.forwardTo] },
    Content: { Raw: { Data: message } },
    ConfigurationSetName: settings.configurationSetName,
  });
}

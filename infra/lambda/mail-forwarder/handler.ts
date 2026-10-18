import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  prepareForwardedMessage,
  reasonNotToForward,
  sendingAddress,
  type SesReceipt,
  type SkipReason,
} from './forwarding';
import { readForwarderSettings } from './settings';

/**
 * Forwards mail that SES received for the domain. The receipt rule stores each message in S3 and
 * then invokes this function, which sends it on to the forward-to address from the mailbox it was
 * addressed to. Each message is logged once, by SES message ID, with what happened to it.
 * Addresses and contents are never logged, and a failure is logged by the error's name only (SES
 * error messages can contain addresses). The failure is then rethrown, so Lambda retries it and
 * finally reports it to the stack's failure topic.
 */

type SesEvent = { Records: { ses: { mail: { messageId: string }; receipt: SesReceipt } }[] };

type Outcome =
  | { messageId: string; forwarded: true }
  | { messageId: string; forwarded: false; reason: SkipReason }
  | { messageId: string; forwarded: false; reason: 'error'; errorName: string };

const settings = readForwarderSettings(process.env);
const s3 = new S3Client({});
const ses = new SESv2Client({});

function log(outcome: Outcome): void {
  console.log(JSON.stringify(outcome));
}

export async function handler(event: SesEvent): Promise<void> {
  for (const { ses: received } of event.Records) {
    const { messageId } = received.mail;
    const reason = reasonNotToForward(received.receipt);
    if (reason) {
      log({ messageId, forwarded: false, reason });
      continue;
    }
    try {
      await forward(messageId, received.receipt.recipients);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      log({ messageId, forwarded: false, reason: 'error', errorName });
      throw new Error(`Forwarding ${messageId} failed (${errorName})`);
    }
    log({ messageId, forwarded: true });
  }
}

async function forward(messageId: string, recipients: string[]): Promise<void> {
  const stored = await s3.send(
    new GetObjectCommand({
      Bucket: settings.messageBucket,
      Key: settings.messagePrefix + messageId,
    }),
  );
  if (!stored.Body) {
    const error = new Error('The stored message has no body');
    error.name = 'EmptyMessage';
    throw error;
  }
  const fromAddress = sendingAddress(recipients, settings.forwardedAddresses);
  const message = prepareForwardedMessage(await stored.Body.transformToByteArray(), {
    fromAddress,
    forwarderName: settings.forwarderName,
  });
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: { ToAddresses: [settings.forwardTo] },
      Content: { Raw: { Data: message } },
    }),
  );
}

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { prepareForwardedMessage, reasonNotToForward, type Receipt } from './mail-forwarding';

/**
 * Forwards mail that SES received for the domain. The receipt rule first stores each message in
 * S3, then invokes this function, which sends it on to FORWARD_TO from the address it was sent to.
 * Logs carry message IDs and decisions only, no addresses or content.
 */

type SesRecord = { ses: { mail: { messageId: string }; receipt: Receipt } };

const s3 = new S3Client({});
const ses = new SESv2Client({});

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function handler(event: { Records: SesRecord[] }): Promise<void> {
  const bucket = setting('MESSAGE_BUCKET');
  const prefix = setting('MESSAGE_PREFIX');
  const forwardTo = setting('FORWARD_TO');
  const senderName = setting('SENDER_NAME');
  const mailboxes = setting('FORWARDED_ADDRESSES').split(',');

  for (const { ses: received } of event.Records) {
    const { messageId } = received.mail;
    const reason = reasonNotToForward(received.receipt);
    if (reason) {
      console.log(JSON.stringify({ messageId, forwarded: false, reason }));
      continue;
    }

    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: prefix + messageId }));
    if (!object.Body) throw new Error(`Message ${messageId} is empty in S3`);
    const raw = Buffer.from(await object.Body.transformToByteArray()).toString('latin1');

    // Send from the mailbox the message was addressed to (it is a verified identity).
    const recipients = received.receipt.recipients.map((address) => address.toLowerCase());
    const from = recipients.find((address) => mailboxes.includes(address)) ?? mailboxes[0];

    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [forwardTo] },
        Content: {
          Raw: { Data: Buffer.from(prepareForwardedMessage(raw, from, senderName), 'latin1') },
        },
      }),
    );
    console.log(JSON.stringify({ messageId, forwarded: true }));
  }
}

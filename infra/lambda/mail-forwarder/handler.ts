import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  forwardReceivedMail,
  type ForwarderDependencies,
  type SesReceivingEvent,
} from './forward-received-mail';
import { readForwarderSettings } from './settings';

/**
 * Entry point of the forwarder, which the receipt rule invokes after storing each message in S3:
 * forwardReceivedMail with real S3 and SES clients, created once per Lambda instance.
 */

const settings = readForwarderSettings(process.env);
const s3 = new S3Client({});
const ses = new SESv2Client({});

const dependencies: ForwarderDependencies = {
  settings,
  async readMessage(key) {
    const stored = await s3.send(
      new GetObjectCommand({ Bucket: settings.messageBucketName, Key: key }),
    );
    if (!stored.Body) {
      throw Object.assign(new Error('The stored message has no body'), { name: 'EmptyMessage' });
    }
    return stored.Body.transformToByteArray();
  },
  async sendEmail(request) {
    await ses.send(new SendEmailCommand(request));
  },
  log(outcome) {
    console.log(JSON.stringify(outcome));
  },
};

export function handler(event: SesReceivingEvent): Promise<void> {
  return forwardReceivedMail(event, dependencies);
}

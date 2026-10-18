/**
 * The decisions behind forwarding mail that SES receives for the domain, free of AWS calls so they
 * can be tested. MailStack runs the configuration checks when synthesizing; handler.ts reads each
 * message, decides and sends.
 */

/** A verdict SES reports for a received message. */
export type SesVerdictStatus = 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED';

/** The part of the SES receiving event's receipt object that forwarding uses. */
export type SesReceipt = {
  /** The envelope recipients that the receipt rule matched. */
  recipients: string[];
  spamVerdict?: { status: SesVerdictStatus };
  virusVerdict?: { status: SesVerdictStatus };
  dmarcVerdict?: { status: SesVerdictStatus };
  /** The sending domain's DMARC policy; SES includes it only when the message fails DMARC. */
  dmarcPolicy?: 'none' | 'quarantine' | 'reject';
};

/** Why a received message is kept in the bucket but not forwarded. */
export type SkipReason = 'virus' | 'spam' | 'dmarc-reject';

/**
 * Why a message must not be forwarded, or null to forward it: it carries a virus, SES judged it
 * spam, or it fails DMARC for a domain that asks for such mail to be rejected (likely spoofed).
 * Skipped messages stay in the bucket until it expires them.
 */
export function reasonNotToForward(receipt: SesReceipt): SkipReason | null {
  if (receipt.virusVerdict?.status === 'FAIL') return 'virus';
  if (receipt.spamVerdict?.status === 'FAIL') return 'spam';
  if (receipt.dmarcVerdict?.status === 'FAIL' && receipt.dmarcPolicy === 'reject') {
    return 'dmarc-reject';
  }
  return null;
}

const LOCAL_PART = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/**
 * Full addresses of the forwarded mailboxes, from local parts such as "support". Throws unless
 * there is at least one and all are distinct lowercase local parts: the addresses feed the receipt
 * rule (an empty list would match every recipient), the IAM condition on sending and the
 * forwarder, which compare them exactly.
 */
export function forwardedAddresses(
  localParts: readonly string[],
  domain: string,
): [string, ...string[]] {
  if (localParts.length === 0) {
    throw new Error('At least one forwarded mailbox is needed, such as "support"');
  }
  for (const localPart of localParts) {
    if (!LOCAL_PART.test(localPart)) {
      throw new Error(
        'Forwarded mailboxes must be lowercase local parts such as "support" (no @ or domain), ' +
          `got "${localPart}"`,
      );
    }
  }
  if (new Set(localParts).size !== localParts.length) {
    throw new Error(`Forwarded mailboxes must be distinct, got ${localParts.join(', ')}`);
  }
  const [first, ...rest] = localParts.map((localPart) => `${localPart}@${domain}`);
  return [first, ...rest];
}

/**
 * The forwarded address a copy is sent from: the first of `addresses` that the message was
 * addressed to, otherwise the first of them. Addresses are compared without case.
 */
export function sendingAddress(
  recipients: readonly string[],
  addresses: readonly [string, ...string[]],
): string {
  const addressed = new Set(recipients.map((recipient) => recipient.toLowerCase()));
  return addresses.find((address) => addressed.has(address.toLowerCase())) ?? addresses[0];
}

// What a quoted From display name can hold as is: printable ASCII except the double quote (\x22)
// and the backslash (\x5c), which would end or escape the quoted text.
const DISPLAY_NAME = /^[\x20\x21\x23-\x5b\x5d-\x7e]+$/;
const NOT_DISPLAY_NAME = /[^\x20\x21\x23-\x5b\x5d-\x7e]/g;

/** Returns the name unchanged if a From display name can hold it as is (see above), else throws. */
export function checkedForwarderName(name: string): string {
  if (!DISPLAY_NAME.test(name)) {
    throw new Error(
      'forwarderName must be printable ASCII without quotes or backslashes, such as ' +
        `"Living With Krishna", got "${name}"`,
    );
  }
  return name;
}

export type ForwardingOptions = {
  /** The forwarded mailbox the copy is sent from, a verified SES identity such as support@. */
  fromAddress: string;
  /** Shown as "<original sender> via <forwarderName>" in the From name; see checkedForwarderName. */
  forwarderName: string;
};

// Wrong once the message is resent from another address, or would fail checks after the edit.
const REMOVED_HEADERS = new Set(['from', 'return-path', 'sender', 'message-id', 'dkim-signature']);

type HeaderField = {
  /** Lower-case field name. */
  name: string;
  /** The value with folded lines joined. */
  value: string;
  /** The field exactly as received, including folded lines. */
  text: string;
};

/**
 * Turns a received message into one SES can send on, bytes in and bytes out. From becomes
 * `fromAddress` with the original sender in the display name, Reply-To keeps the original sender
 * so replies reach them (unless the message already has a Reply-To), and Return-Path, Sender,
 * Message-ID and DKIM-Signature are removed. Every other header and the body keep their exact
 * bytes: the headers are edited as latin1 text, which maps each byte to one character and back.
 */
export function prepareForwardedMessage(
  received: Uint8Array,
  { fromAddress, forwarderName }: ForwardingOptions,
): Uint8Array {
  const raw = Buffer.from(received).toString('latin1');
  const end = raw.search(/\r?\n\r?\n/);
  const headerText = end === -1 ? raw : raw.slice(0, end);
  const rest = end === -1 ? '' : raw.slice(end);
  // Mail uses CRLF; check the whole message, since a one-line header has no line break of its own.
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const fields = parseHeaderFields(headerText, newline);

  const from = fields.find((field) => field.name === 'from');
  const sender = from ? addressIn(from.value) : null;
  const hasReplyTo = fields.some((field) => field.name === 'reply-to');
  const display = `${sender ?? 'Unknown sender'} via ${forwarderName}`.replace(
    NOT_DISPLAY_NAME,
    '',
  );

  const added = [`From: "${display}" <${fromAddress}>`];
  if (from && !hasReplyTo) added.push(`Reply-To: ${from.value}`);
  const kept = fields.filter((field) => !REMOVED_HEADERS.has(field.name)).map((f) => f.text);
  return Buffer.from([...added, ...kept].join(newline) + rest, 'latin1');
}

function parseHeaderFields(headerText: string, newline: string): HeaderField[] {
  const fields: HeaderField[] = [];
  for (const line of headerText.split(newline)) {
    const last = fields[fields.length - 1];
    if (/^[ \t]/.test(line) && last) {
      last.text += newline + line;
      last.value += ' ' + line.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    fields.push({
      name: line.slice(0, colon).trim().toLowerCase(),
      value: line.slice(colon + 1).trim(),
      text: line,
    });
  }
  return fields;
}

/** The email address in a header value such as `Jane <jane@example.com>` or `jane@example.com`. */
function addressIn(value: string): string | null {
  const angle = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle) return angle[1];
  const bare = value.match(/[^\s<>"(),;:]+@[^\s<>"(),;:]+/);
  return bare ? bare[0] : null;
}

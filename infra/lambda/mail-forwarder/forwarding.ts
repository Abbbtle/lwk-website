/**
 * The rules for forwarding mail that SES receives for the domain, free of AWS calls so they can be
 * tested. MailStack runs the configuration checks when synthesizing; forward-received-mail.ts
 * applies the rest to each received message.
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
 * forwarder, and lowercase gives every one of them, and the site's published addresses, the same
 * spelling.
 */
export function forwardedAddresses(
  localParts: readonly string[],
  domain: string,
): [string, ...string[]] {
  if (localParts.length === 0) {
    throw new Error('forwardedLocalParts must list at least one mailbox, such as "support"');
  }
  for (const localPart of localParts) {
    if (!LOCAL_PART.test(localPart)) {
      throw new Error(
        'forwardedLocalParts must be lowercase local parts such as "support" (no @ or domain), ' +
          `got "${localPart}"`,
      );
    }
  }
  if (new Set(localParts).size !== localParts.length) {
    throw new Error(`forwardedLocalParts must be distinct, got ${localParts.join(', ')}`);
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

// What the quoted display name in From can hold as is: printable ASCII except the double quote
// (\x22) and the backslash (\x5c), which would end or escape the quoted text.
const QUOTABLE = '\\x20\\x21\\x23-\\x5b\\x5d-\\x7e';
const UNQUOTABLE = new RegExp(`[^${QUOTABLE}]`, 'g');

/** Returns the name unchanged if a From display name can hold it as is (see above), else throws. */
export function checkedForwarderName(name: string): string {
  if (name === '' || name.replace(UNQUOTABLE, '') !== name) {
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
 * Message-ID and DKIM-Signature are removed. Only the header is decoded and rewritten (as latin1
 * text, which keeps every byte of the other fields); the body is passed on untouched, which also
 * keeps a large message from being copied more than once.
 */
export function prepareForwardedMessage(
  received: Uint8Array,
  { fromAddress, forwarderName }: ForwardingOptions,
): Uint8Array {
  const bytes = Buffer.from(received.buffer, received.byteOffset, received.byteLength);
  const end = headerEnd(bytes);
  // Mail uses CRLF; check the whole message, since a one-line header has no line break of its own.
  const newline = bytes.includes('\r\n') ? '\r\n' : '\n';
  const fields = parseHeaderFields(bytes.toString('latin1', 0, end), newline);

  const from = fields.find((field) => field.name === 'from');
  const sender = from ? addressIn(from.value) : null;
  const hasReplyTo = fields.some((field) => field.name === 'reply-to');
  const display = `${sender ?? 'Unknown sender'} via ${forwarderName}`.replace(UNQUOTABLE, '');

  const added = [`From: "${display}" <${fromAddress}>`];
  if (from && !hasReplyTo) added.push(`Reply-To: ${from.value}`);
  const kept = fields.filter((field) => !REMOVED_HEADERS.has(field.name)).map((f) => f.text);
  const header = Buffer.from([...added, ...kept].join(newline), 'latin1');
  return Buffer.concat([header, bytes.subarray(end)]);
}

const CR = 0x0d;
const LF = 0x0a;

/**
 * Where the header ends: at the line break before the first empty line (CRLF or LF), or at the end
 * of a message that has no body.
 */
function headerEnd(bytes: Buffer): number {
  for (let at = bytes.indexOf(LF); at !== -1; at = bytes.indexOf(LF, at + 1)) {
    const next = bytes[at + 1] === CR ? at + 2 : at + 1;
    if (bytes[next] === LF) return bytes[at - 1] === CR ? at - 1 : at;
  }
  return bytes.length;
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

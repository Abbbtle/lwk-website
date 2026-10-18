/**
 * The decisions behind forwarding mail that SES receives for the domain, kept free of AWS calls
 * so they can be tested (see mail-forwarder.ts for the Lambda that uses them).
 */

/** A verdict SES attaches to a received message. */
export type Verdict = { status: string };

/** The part of the SES event that describes how a message was received and checked. */
export type Receipt = {
  recipients: string[];
  spamVerdict?: Verdict;
  virusVerdict?: Verdict;
  dmarcVerdict?: Verdict;
  /** The sending domain's DMARC policy: none, quarantine or reject. */
  dmarcPolicy?: string;
};

/**
 * Why a message must not be forwarded, or null to forward it: it carries a virus, SES judged it
 * spam, or it fails DMARC for a domain that asks for such mail to be rejected (likely spoofed).
 * Skipped messages stay in the S3 bucket, so nothing is lost silently.
 */
export function reasonNotToForward(receipt: Receipt): string | null {
  if (receipt.virusVerdict?.status === 'FAIL') return 'virus';
  if (receipt.spamVerdict?.status === 'FAIL') return 'spam';
  if (receipt.dmarcVerdict?.status === 'FAIL' && receipt.dmarcPolicy?.toLowerCase() === 'reject') {
    return 'dmarc-reject';
  }
  return null;
}

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
 * Turns a received message into one SES can send on. From becomes the forwarding address (SES only
 * sends from verified identities) with the original sender in the display name, Reply-To keeps
 * the original sender so replies reach them (unless the message already has a Reply-To), and
 * Return-Path, Sender, Message-ID and DKIM-Signature are removed. Every other header and the body
 * are left exactly as received. The message is handled as a latin1 string so every byte survives.
 */
export function prepareForwardedMessage(
  raw: string,
  forwardingAddress: string,
  senderName: string,
): string {
  const end = raw.search(/\r?\n\r?\n/);
  const headerText = end === -1 ? raw : raw.slice(0, end);
  const rest = end === -1 ? '' : raw.slice(end);
  // Mail uses CRLF; check the whole message, since a one-line header has no line break of its own.
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const fields = parseHeaderFields(headerText, newline);

  const from = fields.find((field) => field.name === 'from');
  const sender = from ? addressIn(from.value) : null;
  const replyTo = fields.some((field) => field.name === 'reply-to');
  const display = `${sender ?? 'Unknown sender'} via ${senderName}`.replace(/["\\\r\n]/g, '');

  const added = [`From: "${display}" <${forwardingAddress}>`];
  if (from && !replyTo) added.push(`Reply-To: ${from.value}`);
  const kept = fields.filter((field) => !REMOVED_HEADERS.has(field.name)).map((f) => f.text);
  return [...added, ...kept].join(newline) + rest;
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

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { prepareForwardedMessage, reasonNotToForward } from '../lambda/mail-forwarding';

const SUPPORT = 'support@livingwithkrishna.com';
const NAME = 'Living With Krishna';

function message(headers: string[], body = 'Hare Krishna,\r\nI cannot log in.\r\n'): string {
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

function headerLines(raw: string): string[] {
  return raw.slice(0, raw.indexOf('\r\n\r\n')).split('\r\n');
}

describe('preparing a received message for forwarding', () => {
  const received = message([
    'Return-Path: <jane@example.com>',
    'DKIM-Signature: v=1; a=rsa-sha256; d=example.com;',
    '\tb=abc123',
    'From: Jane Doe <jane@example.com>',
    'Sender: jane@example.com',
    'To: support@livingwithkrishna.com',
    'Subject: Help with my course',
    'Message-ID: <123@example.com>',
    'MIME-Version: 1.0',
  ]);
  const forwarded = prepareForwardedMessage(received, SUPPORT, NAME);
  const lines = headerLines(forwarded);

  it('sends from the forwarding address with the original sender in the name', () => {
    assert.ok(
      lines.includes(`From: "jane@example.com via ${NAME}" <${SUPPORT}>`),
      lines.join('\n'),
    );
  });

  it('keeps the original sender as Reply-To, so replies reach them', () => {
    assert.ok(lines.includes('Reply-To: Jane Doe <jane@example.com>'));
  });

  it('removes headers that would be wrong or fail checks after resending', () => {
    for (const name of ['Return-Path', 'Sender', 'Message-ID', 'DKIM-Signature']) {
      assert.ok(!lines.some((line) => line.startsWith(`${name}:`)), name);
    }
    assert.ok(!lines.includes('\tb=abc123'), 'the folded DKIM line goes with its field');
    assert.equal(lines.filter((line) => line.startsWith('From:')).length, 1);
  });

  it('leaves the other headers and the body exactly as received', () => {
    for (const kept of [
      'To: support@livingwithkrishna.com',
      'Subject: Help with my course',
      'MIME-Version: 1.0',
    ]) {
      assert.ok(lines.includes(kept), kept);
    }
    assert.ok(forwarded.endsWith('\r\n\r\nHare Krishna,\r\nI cannot log in.\r\n'));
  });

  it('keeps an existing Reply-To', () => {
    const result = prepareForwardedMessage(
      message(['From: jane@example.com', 'Reply-To: office@example.com', 'Subject: Hi']),
      SUPPORT,
      NAME,
    );
    const replyTo = headerLines(result).filter((line) => line.startsWith('Reply-To:'));
    assert.deepEqual(replyTo, ['Reply-To: office@example.com']);
  });

  it('handles encoded display names and bare addresses', () => {
    const encoded = prepareForwardedMessage(
      message(['From: =?UTF-8?B?UmFkaGE=?= <radha@example.org>', 'Subject: Hi']),
      SUPPORT,
      NAME,
    );
    assert.ok(headerLines(encoded).includes(`From: "radha@example.org via ${NAME}" <${SUPPORT}>`));
    assert.ok(headerLines(encoded).includes('Reply-To: =?UTF-8?B?UmFkaGE=?= <radha@example.org>'));
  });

  it('keeps every byte of an 8-bit body', () => {
    const body = 'Caf\xe9 \xa9\r\n';
    const result = prepareForwardedMessage(message(['From: a@example.com'], body), SUPPORT, NAME);
    assert.ok(result.endsWith(body));
  });

  it('still forwards a message without a From header', () => {
    const lines = headerLines(prepareForwardedMessage(message(['Subject: Hi']), SUPPORT, NAME));
    assert.ok(lines.includes(`From: "Unknown sender via ${NAME}" <${SUPPORT}>`));
    assert.ok(!lines.some((line) => line.startsWith('Reply-To:')));
  });

  it('works with LF line endings', () => {
    const result = prepareForwardedMessage(
      'From: jane@example.com\nSubject: Hi\n\nBody\n',
      SUPPORT,
      NAME,
    );
    assert.ok(result.startsWith(`From: "jane@example.com via ${NAME}" <${SUPPORT}>\n`));
    assert.ok(result.endsWith('\n\nBody\n'));
  });
});

describe('deciding whether to forward', () => {
  const pass = { status: 'PASS' };
  const fail = { status: 'FAIL' };
  const base = { recipients: [SUPPORT], spamVerdict: pass, virusVerdict: pass, dmarcVerdict: pass };

  it('forwards clean mail', () => {
    assert.equal(reasonNotToForward(base), null);
  });

  it('skips viruses and spam', () => {
    assert.equal(reasonNotToForward({ ...base, virusVerdict: fail }), 'virus');
    assert.equal(reasonNotToForward({ ...base, spamVerdict: fail }), 'spam');
  });

  it('skips mail that fails DMARC only when the sending domain asks for rejection', () => {
    assert.equal(
      reasonNotToForward({ ...base, dmarcVerdict: fail, dmarcPolicy: 'reject' }),
      'dmarc-reject',
    );
    assert.equal(reasonNotToForward({ ...base, dmarcVerdict: fail, dmarcPolicy: 'none' }), null);
  });

  it('forwards when SES could not decide', () => {
    assert.equal(reasonNotToForward({ ...base, spamVerdict: { status: 'GRAY' } }), null);
  });
});

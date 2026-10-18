import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import {
  forwardReceivedMail,
  type ForwarderDependencies,
  type ForwardingOutcome,
  type SesReceivingEvent,
} from '../lambda/mail-forwarder/forward-received-mail';
import {
  checkedForwarderName,
  forwardedAddresses,
  prepareForwardedMessage,
  reasonNotToForward,
  sendingAddress,
  type ForwardingOptions,
  type SesReceipt,
} from '../lambda/mail-forwarder/forwarding-rules';
import {
  forwarderEnvironment,
  readForwarderSettings,
  type ForwarderSettings,
} from '../lambda/mail-forwarder/settings';

const SUPPORT = 'support@livingwithkrishna.com';
const HELLO = 'hello@livingwithkrishna.com';
const NAME = 'Living With Krishna';
const OPTIONS: ForwardingOptions = { fromAddress: SUPPORT, forwarderName: NAME };
const SETTINGS: ForwarderSettings = {
  messageBucketName: 'lwk-mail-messagebucket',
  messageKeyPrefix: 'inbound/',
  forwardTo: 'someone@example.com',
  forwarderName: NAME,
  forwardedAddresses: [SUPPORT, HELLO],
  configurationSetName: 'forwarded-mail',
};

/** Forwards a message given as latin1 text (one character per byte) and returns it the same way. */
function forward(raw: string): string {
  return Buffer.from(prepareForwardedMessage(Buffer.from(raw, 'latin1'), OPTIONS)).toString(
    'latin1',
  );
}

function message(headers: string[], body = 'Hare Krishna,\r\nI cannot log in.\r\n'): string {
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

function headerLines(raw: string): string[] {
  return raw.slice(0, raw.indexOf('\r\n\r\n')).split('\r\n');
}

describe('preparing a received message for forwarding', () => {
  const forwarded = forward(
    message([
      'Return-Path: <jane@example.com>',
      'DKIM-Signature: v=1; a=rsa-sha256; d=example.com;',
      '\tb=abc123',
      'From: Jane Doe <jane@example.com>',
      'Sender: jane@example.com',
      'To: support@livingwithkrishna.com',
      'Subject: Help with my course',
      'Message-ID: <123@example.com>',
      'MIME-Version: 1.0',
    ]),
  );
  const lines = headerLines(forwarded);

  it('sends from the forwarded mailbox with the original sender in the name', () => {
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
    const result = forward(
      message(['From: jane@example.com', 'Reply-To: office@example.com', 'Subject: Hi']),
    );
    const replyTo = headerLines(result).filter((line) => line.startsWith('Reply-To:'));
    assert.deepEqual(replyTo, ['Reply-To: office@example.com']);
  });

  it('handles encoded display names and bare addresses', () => {
    const encoded = headerLines(
      forward(message(['From: =?UTF-8?B?UmFkaGE=?= <radha@example.org>', 'Subject: Hi'])),
    );
    assert.ok(encoded.includes(`From: "radha@example.org via ${NAME}" <${SUPPORT}>`));
    assert.ok(encoded.includes('Reply-To: =?UTF-8?B?UmFkaGE=?= <radha@example.org>'));
  });

  it('puts only what a quoted name can hold into the From name', () => {
    const lines = headerLines(forward(message(['From: <"odd\\"name"@example.com>'])));
    assert.ok(lines.includes(`From: "oddname@example.com via ${NAME}" <${SUPPORT}>`), lines[0]);
  });

  it('keeps every byte of 8-bit headers and bodies', () => {
    const subject = Buffer.from('Subject: Gītā class at the café', 'utf8');
    const body = Buffer.from('Hari bol ©\r\n', 'utf8');
    const received = Buffer.concat([
      Buffer.from('From: a@example.com\r\n'),
      subject,
      Buffer.from('\r\n\r\n'),
      body,
    ]);
    const result = Buffer.from(prepareForwardedMessage(received, OPTIONS));
    assert.ok(result.includes(subject));
    assert.ok(result.subarray(result.length - body.length).equals(body));
  });

  it('reads only its own bytes when they are part of a larger buffer', () => {
    const raw = message(['From: jane@example.com', 'Subject: Hi'], 'Body\r\n');
    const shared = Buffer.from(`before|${raw}|after`, 'latin1');
    const received = shared.subarray('before|'.length, 'before|'.length + raw.length);
    const result = Buffer.from(prepareForwardedMessage(received, OPTIONS)).toString('latin1');
    assert.ok(result.startsWith(`From: "jane@example.com via ${NAME}" <${SUPPORT}>\r\n`));
    assert.ok(result.endsWith('Subject: Hi\r\n\r\nBody\r\n'), result);
  });

  it('still forwards a message without a From header', () => {
    const lines = headerLines(forward(message(['Subject: Hi'])));
    assert.ok(lines.includes(`From: "Unknown sender via ${NAME}" <${SUPPORT}>`));
    assert.ok(!lines.some((line) => line.startsWith('Reply-To:')));
  });

  it('works with LF line endings', () => {
    const result = forward('From: jane@example.com\nSubject: Hi\n\nBody\n');
    assert.ok(result.startsWith(`From: "jane@example.com via ${NAME}" <${SUPPORT}>\n`));
    assert.ok(result.endsWith('\n\nBody\n'));
  });

  it('keeps CRLF line endings when the header is a single line', () => {
    const result = forward('Subject: Hi\r\n\r\nBody\r\n');
    assert.equal(
      result,
      `From: "Unknown sender via ${NAME}" <${SUPPORT}>\r\nSubject: Hi\r\n\r\nBody\r\n`,
    );
  });
});

describe('deciding whether to forward', () => {
  const base: SesReceipt = {
    recipients: [SUPPORT],
    spamVerdict: { status: 'PASS' },
    virusVerdict: { status: 'PASS' },
    dmarcVerdict: { status: 'PASS' },
  };

  it('forwards clean mail', () => {
    assert.equal(reasonNotToForward(base), null);
  });

  it('skips viruses and spam', () => {
    assert.equal(reasonNotToForward({ ...base, virusVerdict: { status: 'FAIL' } }), 'virus');
    assert.equal(reasonNotToForward({ ...base, spamVerdict: { status: 'FAIL' } }), 'spam');
  });

  it('skips mail that fails DMARC only when the sending domain asks for rejection', () => {
    const failed: SesReceipt = { ...base, dmarcVerdict: { status: 'FAIL' } };
    assert.equal(reasonNotToForward({ ...failed, dmarcPolicy: 'reject' }), 'dmarc-reject');
    assert.equal(reasonNotToForward({ ...failed, dmarcPolicy: 'quarantine' }), null);
    assert.equal(reasonNotToForward({ ...failed, dmarcPolicy: 'none' }), null);
  });

  it('forwards when SES could not decide', () => {
    assert.equal(reasonNotToForward({ ...base, spamVerdict: { status: 'GRAY' } }), null);
    assert.equal(
      reasonNotToForward({ ...base, virusVerdict: { status: 'PROCESSING_FAILED' } }),
      null,
    );
  });
});

describe('forwarded addresses', () => {
  it('are the local parts at the domain, in lower case', () => {
    assert.deepEqual(forwardedAddresses(['support', 'hello'], 'LivingWithKrishna.com'), [
      SUPPORT,
      HELLO,
    ]);
  });

  it('need at least one distinct, lowercase local part without a domain', () => {
    for (const localParts of [[], ['Support'], [SUPPORT], ['support', 'support'], [' support']]) {
      assert.throws(
        () => forwardedAddresses(localParts, 'livingwithkrishna.com'),
        /^Error: forwardedLocalParts /,
        JSON.stringify(localParts),
      );
    }
  });
});

describe('the address a copy is sent from', () => {
  const addresses = [SUPPORT, HELLO] as const;

  it('is the forwarded mailbox the message was addressed to, in any case', () => {
    assert.equal(sendingAddress(['Hello@LivingWithKrishna.com'], addresses), HELLO);
  });

  it('is the first forwarded mailbox when none of them was addressed', () => {
    assert.equal(sendingAddress(['someone@example.com'], addresses), SUPPORT);
  });
});

describe('the forwarder name', () => {
  it('is used as is when a quoted From name can hold it', () => {
    assert.equal(checkedForwarderName(NAME), NAME);
  });

  it('is refused with quotes, backslashes, line breaks, other than ASCII, or empty', () => {
    for (const name of ['Say "hi"', 'Back\\slash', 'Two\r\nlines', 'Kṛṣṇa', '']) {
      assert.throws(() => checkedForwarderName(name), /forwarderName/, JSON.stringify(name));
    }
  });
});

describe('forwarder settings', () => {
  it('are read back from the environment exactly as the stack writes them', () => {
    assert.deepEqual(readForwarderSettings(forwarderEnvironment(SETTINGS)), SETTINGS);
  });

  it('name each variable that is missing', () => {
    for (const missing of Object.keys(forwarderEnvironment(SETTINGS))) {
      const environment = { ...forwarderEnvironment(SETTINGS), [missing]: undefined };
      assert.throws(() => readForwarderSettings(environment), new RegExp(`${missing} is not set`));
    }
  });

  it('refuse a forward-to address that is itself forwarded, in any case, without naming it', () => {
    for (const looping of [
      { ...SETTINGS, forwardTo: 'Support@LivingWithKrishna.com' },
      { ...SETTINGS, forwardTo: SUPPORT, forwardedAddresses: ['SUPPORT@livingwithkrishna.com'] },
    ] satisfies ForwarderSettings[]) {
      assert.throws(
        () => readForwarderSettings(forwarderEnvironment(looping)),
        (error: Error) =>
          /^FORWARD_TO must not be one of FORWARDED_ADDRESSES/.test(error.message) &&
          !error.message.toLowerCase().includes(SUPPORT),
        looping.forwardTo,
      );
    }
  });
});

describe('forwarding a received event', () => {
  const stored =
    'From: Jane <jane@example.com>\r\nTo: hello@livingwithkrishna.com\r\n\r\nHello\r\n';

  function event(receipt: Partial<SesReceipt> = {}): SesReceivingEvent {
    const clean: SesReceipt = {
      recipients: [HELLO],
      spamVerdict: { status: 'PASS' },
      virusVerdict: { status: 'PASS' },
      dmarcVerdict: { status: 'PASS' },
    };
    return {
      Records: [{ ses: { mail: { messageId: 'm-1' }, receipt: { ...clean, ...receipt } } }],
    };
  }

  /** In-memory stand-ins for S3, SES and the log that record what the forwarder does. */
  function fakes(sendEmail?: ForwarderDependencies['sendEmail']) {
    const read: string[] = [];
    const sent: SendEmailCommandInput[] = [];
    const logged: ForwardingOutcome[] = [];
    const dependencies: ForwarderDependencies = {
      settings: SETTINGS,
      async readMessage(key) {
        read.push(key);
        return Buffer.from(stored, 'latin1');
      },
      sendEmail:
        sendEmail ??
        (async (request) => {
          sent.push(request);
        }),
      log: (outcome) => logged.push(outcome),
    };
    return { dependencies, read, sent, logged };
  }

  it('sends a copy from the addressed mailbox through the configuration set', async () => {
    const { dependencies, read, sent, logged } = fakes();
    await forwardReceivedMail(event(), dependencies);
    assert.deepEqual(read, ['inbound/m-1']);
    assert.equal(sent.length, 1);
    const [request] = sent;
    assert.equal(request.FromEmailAddress, HELLO);
    assert.deepEqual(request.Destination, { ToAddresses: [SETTINGS.forwardTo] });
    assert.equal(request.ConfigurationSetName, SETTINGS.configurationSetName);
    const copy = Buffer.from(request.Content?.Raw?.Data ?? []).toString('latin1');
    assert.ok(copy.startsWith(`From: "jane@example.com via ${NAME}" <${HELLO}>\r\n`), copy);
    assert.deepEqual(logged, [{ messageId: 'm-1', status: 'forwarded' }]);
  });

  it('logs a skipped message and neither reads nor sends it', async () => {
    const { dependencies, read, sent, logged } = fakes();
    await forwardReceivedMail(event({ spamVerdict: { status: 'FAIL' } }), dependencies);
    assert.deepEqual([read, sent], [[], []]);
    assert.deepEqual(logged, [{ messageId: 'm-1', status: 'skipped', reason: 'spam' }]);
  });

  it('logs a failure by error name only and rethrows it, so Lambda retries and reports it', async () => {
    const rejected = Object.assign(
      new Error(`Email address is not verified: ${SETTINGS.forwardTo}`),
      {
        name: 'MessageRejected',
      },
    );
    const { dependencies, logged } = fakes(async () => {
      throw rejected;
    });
    await assert.rejects(forwardReceivedMail(event(), dependencies), (error: Error) => {
      assert.equal(error.message, 'Forwarding m-1 failed (MessageRejected)');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.deepEqual(logged, [
      { messageId: 'm-1', status: 'failed', errorName: 'MessageRejected' },
    ]);
  });
});

/**
 * The settings MailStack hands the forwarder as environment variables, defined once so that the
 * stack and the Lambda cannot drift apart. It imports nothing, so both the CDK app and the Lambda
 * bundle can use it.
 */
export type ForwarderSettings = {
  /** Bucket the receipt rule stores messages in. */
  messageBucket: string;
  /** Prefix of stored messages' keys; a key is the prefix plus the SES message ID. */
  messagePrefix: string;
  /** Where mail is forwarded to, resolved from Parameter Store at deploy time. */
  forwardTo: string;
  /** Shown as "<original sender> via <forwarderName>" in the From name of forwarded mail. */
  forwarderName: string;
  /** Full addresses of the forwarded mailboxes, lower-case. */
  forwardedAddresses: readonly [string, ...string[]];
};

const VARIABLES = {
  messageBucket: 'MESSAGE_BUCKET',
  messagePrefix: 'MESSAGE_PREFIX',
  forwardTo: 'FORWARD_TO',
  forwarderName: 'FORWARDER_NAME',
  forwardedAddresses: 'FORWARDED_ADDRESSES',
} as const satisfies Record<keyof ForwarderSettings, string>;

const LIST_SEPARATOR = ',';

/** The Lambda environment variables that carry these settings. */
export function forwarderEnvironment(settings: ForwarderSettings): Record<string, string> {
  return {
    [VARIABLES.messageBucket]: settings.messageBucket,
    [VARIABLES.messagePrefix]: settings.messagePrefix,
    [VARIABLES.forwardTo]: settings.forwardTo,
    [VARIABLES.forwarderName]: settings.forwarderName,
    [VARIABLES.forwardedAddresses]: settings.forwardedAddresses.join(LIST_SEPARATOR),
  };
}

/** Reads the settings back from the environment, throwing for the first missing variable. */
export function readForwarderSettings(
  environment: Readonly<Record<string, string | undefined>>,
): ForwarderSettings {
  const read = (key: keyof ForwarderSettings): string => {
    const value = environment[VARIABLES[key]];
    if (!value) throw new Error(`${VARIABLES[key]} is not set`);
    return value;
  };
  // Splitting a non-empty value always gives at least one address.
  const [firstAddress, ...otherAddresses] = read('forwardedAddresses').split(LIST_SEPARATOR);
  return {
    messageBucket: read('messageBucket'),
    messagePrefix: read('messagePrefix'),
    forwardTo: read('forwardTo'),
    forwarderName: read('forwarderName'),
    forwardedAddresses: [firstAddress, ...otherAddresses],
  };
}

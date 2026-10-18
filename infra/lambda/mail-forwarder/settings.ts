/**
 * The settings MailStack hands the forwarder as environment variables, defined once so that the
 * stack and the Lambda cannot drift apart. It imports nothing, so both the CDK app and the Lambda
 * bundle can use it.
 */
export type ForwarderSettings = {
  /** Name of the bucket the receipt rule stores messages in. */
  messageBucketName: string;
  /** S3 key prefix of stored messages; a key is the prefix plus the SES message ID. */
  messageKeyPrefix: string;
  /** Where mail is forwarded to, resolved from Parameter Store at deploy time. */
  forwardTo: string;
  /** Shown as "<original sender> via <forwarderName>" in the From name of forwarded mail. */
  forwarderName: string;
  /** Full addresses of the forwarded mailboxes, lower-case. */
  forwardedAddresses: readonly [string, ...string[]];
  /** SES configuration set for forwarded copies, which reports their bounces and complaints. */
  configurationSetName: string;
};

const VARIABLES = {
  messageBucketName: 'MESSAGE_BUCKET_NAME',
  messageKeyPrefix: 'MESSAGE_KEY_PREFIX',
  forwardTo: 'FORWARD_TO',
  forwarderName: 'FORWARDER_NAME',
  forwardedAddresses: 'FORWARDED_ADDRESSES',
  configurationSetName: 'CONFIGURATION_SET_NAME',
} as const satisfies Record<keyof ForwarderSettings, string>;

const LIST_SEPARATOR = ',';

/** The Lambda environment variables that carry these settings. */
export function forwarderEnvironment(settings: ForwarderSettings): Record<string, string> {
  return {
    [VARIABLES.messageBucketName]: settings.messageBucketName,
    [VARIABLES.messageKeyPrefix]: settings.messageKeyPrefix,
    [VARIABLES.forwardTo]: settings.forwardTo,
    [VARIABLES.forwarderName]: settings.forwarderName,
    [VARIABLES.forwardedAddresses]: settings.forwardedAddresses.join(LIST_SEPARATOR),
    [VARIABLES.configurationSetName]: settings.configurationSetName,
  };
}

/**
 * Reads the settings back from the environment. Throws for the first missing variable, and when
 * the forward-to address is itself forwarded, which would send every copy round in a loop (the
 * message names the variables, never the address).
 */
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
  const settings: ForwarderSettings = {
    messageBucketName: read('messageBucketName'),
    messageKeyPrefix: read('messageKeyPrefix'),
    forwardTo: read('forwardTo'),
    forwarderName: read('forwarderName'),
    forwardedAddresses: [firstAddress, ...otherAddresses],
    configurationSetName: read('configurationSetName'),
  };
  if (settings.forwardedAddresses.includes(settings.forwardTo.toLowerCase())) {
    throw new Error(
      `${VARIABLES.forwardTo} must not be one of ${VARIABLES.forwardedAddresses}: ` +
        'mail would be forwarded in a loop',
    );
  }
  return settings;
}

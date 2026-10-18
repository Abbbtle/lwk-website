/** An ISO 3166-1 alpha-2 country code in capitals ("ZA" from " za "), or null for anything else. */
export function toCountryCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

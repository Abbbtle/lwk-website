export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatPrice(usd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usd);
}

/** "1 lesson", "3 lessons". */
export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Join the parts that have a value, e.g. ["2 lessons", null, "1h"] -> "2 lessons · 1h". */
export function joinParts(parts: (string | null | false | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** Rough reading time of a text in minutes (200 words a minute, at least 1). */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

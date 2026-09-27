// Allowed uploads, shared by the upload form (early feedback) and the server (enforcement).

export const MEDIA_RULES = {
  video: {
    label: 'video',
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxBytes: 2 * 1024 ** 3,
    accept: 'video/mp4,video/webm,video/quicktime',
  },
  pdf: {
    label: 'PDF',
    types: ['application/pdf'],
    maxBytes: 100 * 1024 ** 2,
    accept: 'application/pdf',
  },
  cover: {
    label: 'image',
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 ** 2,
    accept: 'image/jpeg,image/png,image/webp',
  },
} as const;

export type MediaKind = keyof typeof MEDIA_RULES;

export const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Returns a message when the file is not allowed, otherwise null. */
export function checkFile(kind: MediaKind, contentType: string, size: number): string | null {
  const rule = MEDIA_RULES[kind];
  if (!(rule.types as readonly string[]).includes(contentType)) {
    return `That file type is not supported for a ${rule.label}.`;
  }
  if (size <= 0) return 'The file is empty.';
  if (size > rule.maxBytes) return `The file is larger than ${formatBytes(rule.maxBytes)}.`;
  return null;
}

'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { checkFile, formatBytes, MEDIA_RULES, type MediaKind } from '@/lib/media-rules';

type Ticket = { url: string; fields: Record<string, string>; key: string };
type Failure = { error: string };

/** Read a video's or recording's length in the browser, so it can be shown. */
function mediaDuration(file: File, kind: 'video' | 'audio'): Promise<number | undefined> {
  return new Promise((resolve) => {
    const media = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const done = (value?: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    media.preload = 'metadata';
    media.onloadedmetadata = () =>
      done(Number.isFinite(media.duration) ? media.duration : undefined);
    media.onerror = () => done(undefined);
    media.src = url;
  });
}

/** POST the file straight to S3 with the presigned form, reporting progress. */
function uploadToS3(ticket: Ticket, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append('file', file); // S3 requires the file to be the last field.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

export function MediaUploader({
  kind,
  label,
  requestUpload,
  confirmUpload,
}: {
  kind: MediaKind;
  label: string;
  requestUpload: (file: { contentType: string; size: number }) => Promise<Ticket | Failure>;
  confirmUpload: (key: string, durationSeconds?: number) => Promise<object | Failure>;
}) {
  const router = useRouter();
  const inputId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const rule = MEDIA_RULES[kind];

  async function handleFile(file: File) {
    setMessage(null);
    const problem = checkFile(kind, file.type, file.size);
    if (problem) return setMessage({ tone: 'error', text: problem });

    setProgress(0);
    try {
      const duration =
        kind === 'video' || kind === 'audio' ? await mediaDuration(file, kind) : undefined;
      const ticket = await requestUpload({ contentType: file.type, size: file.size });
      if ('error' in ticket) throw new Error(ticket.error);
      await uploadToS3(ticket, file, setProgress);
      const confirmed = await confirmUpload(ticket.key, duration);
      if ('error' in confirmed) throw new Error(String(confirmed.error));
      setMessage({ tone: 'ok', text: 'Uploaded.' });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error && !error.message.startsWith('S3 ')
            ? error.message
            : 'Upload failed. Please try again.',
      });
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={`btn-outline px-4 py-2 text-sm ${progress !== null ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload className="size-4" aria-hidden />
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={rule.accept}
        className="sr-only"
        disabled={progress !== null}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />
      <p className="text-xs text-gray-500">Up to {formatBytes(rule.maxBytes)}.</p>
      {progress !== null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full bg-gray-200"
        >
          <div
            className="h-2 bg-brand transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {message && (
        <p
          aria-live="polite"
          className={`text-sm ${message.tone === 'error' ? 'text-red-700' : 'text-green-800'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

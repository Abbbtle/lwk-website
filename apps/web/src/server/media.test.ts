import { describe, expect, it } from 'vitest';
import { checkFile } from '@/lib/media-rules';
import { lessonMediaPrefix, MediaError, verifyUpload } from './media';

describe('checkFile', () => {
  it('accepts allowed types within the size limit', () => {
    expect(checkFile('video', 'video/mp4', 500 * 1024 ** 2)).toBeNull();
    expect(checkFile('pdf', 'application/pdf', 1024)).toBeNull();
    expect(checkFile('cover', 'image/webp', 1024)).toBeNull();
  });

  it('rejects other types, empty files and oversized files', () => {
    expect(checkFile('video', 'application/pdf', 1024)).toMatch(/not supported/);
    expect(checkFile('cover', 'image/svg+xml', 1024)).toMatch(/not supported/);
    expect(checkFile('pdf', 'application/pdf', 0)).toMatch(/empty/);
    expect(checkFile('cover', 'image/png', 6 * 1024 ** 2)).toMatch(/larger than 5 MB/);
    expect(checkFile('video', 'video/mp4', 3 * 1024 ** 3)).toMatch(/larger than 2.0 GB/);
  });
});

describe('verifyUpload', () => {
  it('refuses keys outside the lesson or cover folder before touching S3', async () => {
    const prefix = lessonMediaPrefix('course-a', 'lesson-a');
    for (const key of [
      'courses/course-b/lessons/lesson-b/file.mp4',
      `${prefix}../../other/file.mp4`,
      'file.mp4',
    ]) {
      await expect(verifyUpload(key, prefix, 'video')).rejects.toBeInstanceOf(MediaError);
    }
  });
});

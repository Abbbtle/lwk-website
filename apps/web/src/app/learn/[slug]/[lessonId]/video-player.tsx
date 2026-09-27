'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { saveVideoPosition, setLessonComplete } from '../../actions';

const SAVE_EVERY_SECONDS = 15;

/**
 * Plays the lesson video, resumes where the learner stopped, saves the position while playing
 * and on pause, and marks the lesson complete when the video ends.
 */
export function VideoPlayer({
  src,
  lessonId,
  courseSlug,
  resumeAt,
  track,
  title,
}: {
  src: string;
  lessonId: string;
  courseSlug: string;
  resumeAt: number;
  /** False for previews and viewers who are not enrolled. */
  track: boolean;
  title: string;
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    const el = video.current;
    if (!el || !track) return;
    const save = () => {
      lastSaved.current = el.currentTime;
      void saveVideoPosition(lessonId, el.currentTime);
    };
    const onTimeUpdate = () => {
      if (Math.abs(el.currentTime - lastSaved.current) >= SAVE_EVERY_SECONDS) save();
    };
    const onEnded = async () => {
      await setLessonComplete(lessonId, courseSlug, true);
      router.refresh();
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('pause', save);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('pause', save);
      el.removeEventListener('ended', onEnded);
    };
  }, [lessonId, courseSlug, track, router]);

  return (
    <video
      ref={video}
      controls
      preload="metadata"
      playsInline
      src={src}
      aria-label={title}
      className="aspect-video w-full bg-black"
      // Resume, unless the learner was within the last few seconds.
      onLoadedMetadata={(event) => {
        const el = event.currentTarget;
        if (resumeAt > 0 && (!Number.isFinite(el.duration) || resumeAt < el.duration - 5)) {
          el.currentTime = resumeAt;
          lastSaved.current = resumeAt;
        }
      }}
    />
  );
}

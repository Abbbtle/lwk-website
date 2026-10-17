import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { MediaUploader } from '@/components/media-uploader';
import { lessonTypeOptions } from '@/lib/forms/course';
import type { EditableCourse } from '@/server/authoring';
import {
  addLesson,
  addSection,
  confirmLessonUpload,
  deleteLesson,
  deleteSection,
  moveLesson,
  moveSection,
  renameSection,
  requestLessonUpload,
  updateLesson,
} from '../../actions';

const input =
  'w-full border border-gray-300 bg-white px-3 py-2 focus:border-black focus:outline-none';
const iconButton =
  'cursor-pointer border border-gray-300 p-1.5 hover:border-black disabled:cursor-not-allowed disabled:opacity-40';

function MoveButtons({
  onUp,
  onDown,
  first,
  last,
  label,
}: {
  onUp: () => Promise<void>;
  onDown: () => Promise<void>;
  first: boolean;
  last: boolean;
  label: string;
}) {
  return (
    <>
      <form action={onUp}>
        <button
          type="submit"
          className={iconButton}
          disabled={first}
          aria-label={`Move ${label} up`}
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
      <form action={onDown}>
        <button
          type="submit"
          className={iconButton}
          disabled={last}
          aria-label={`Move ${label} down`}
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </form>
    </>
  );
}

function LessonMedia({
  lesson,
  courseId,
  url,
  locked,
}: {
  lesson: EditableCourse['sections'][number]['lessons'][number];
  courseId: string;
  url?: string;
  locked: boolean;
}) {
  if (lesson.type === 'TEXT') return null;
  const isVideo = lesson.type === 'VIDEO';
  return (
    <div className="space-y-3 bg-surface p-3">
      {url ? (
        isVideo ? (
          <video
            controls
            preload="metadata"
            src={url}
            className="aspect-video w-full max-w-xl bg-black"
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold underline"
          >
            Open the PDF
          </a>
        )
      ) : (
        <p className="text-sm text-gray-700">No {isVideo ? 'video' : 'PDF'} uploaded yet.</p>
      )}
      {!locked && (
        <MediaUploader
          kind={isVideo ? 'video' : 'pdf'}
          label={`${url ? 'Replace' : 'Upload'} ${isVideo ? 'video' : 'PDF'}`}
          requestUpload={requestLessonUpload.bind(null, lesson.id)}
          confirmUpload={confirmLessonUpload.bind(null, lesson.id, courseId)}
        />
      )}
    </div>
  );
}

export function Curriculum({
  course,
  locked,
  mediaUrls,
}: {
  course: EditableCourse;
  locked: boolean;
  /** Signed preview links for uploaded lesson files, keyed by lesson id. */
  mediaUrls: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      {course.sections.map((section, sIndex) => (
        <section key={section.id} className="border border-gray-300">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 bg-gray-100 p-3">
            <span className="text-sm font-bold text-gray-500">Section {sIndex + 1}</span>
            {locked ? (
              <h3 className="font-semibold">{section.title}</h3>
            ) : (
              <>
                <form action={renameSection.bind(null, section.id)} className="flex flex-1 gap-2">
                  <label htmlFor={`section-${section.id}`} className="sr-only">
                    Section title
                  </label>
                  <input
                    id={`section-${section.id}`}
                    name="title"
                    defaultValue={section.title}
                    required
                    maxLength={150}
                    className={`${input} font-semibold`}
                  />
                  <button type="submit" className="btn-outline px-3 py-1.5 text-sm">
                    Rename
                  </button>
                </form>
                <MoveButtons
                  label="section"
                  onUp={moveSection.bind(null, section.id, 'up')}
                  onDown={moveSection.bind(null, section.id, 'down')}
                  first={sIndex === 0}
                  last={sIndex === course.sections.length - 1}
                />
                <form action={deleteSection.bind(null, section.id)}>
                  <button
                    type="submit"
                    className={iconButton}
                    aria-label={`Delete section ${section.title} and its lessons`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </>
            )}
          </div>

          <ol className="divide-y divide-gray-300">
            {section.lessons.map((lesson, lIndex) => (
              <li key={lesson.id} className="p-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="text-gray-500">{lIndex + 1}.</span>{' '}
                      <span className="font-medium">{lesson.title}</span>{' '}
                      <span className="text-sm text-gray-600">
                        · {lessonTypeOptions.find((t) => t.value === lesson.type)?.label}
                        {lesson.isPreview && ' · free preview'}
                        {lesson.type !== 'TEXT' && !lesson.mediaKey && ' · file needed'}
                      </span>
                    </span>
                    <span className="text-sm text-gray-500">{locked ? 'View' : 'Edit'}</span>
                  </summary>

                  <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                    <LessonMedia
                      lesson={lesson}
                      courseId={course.id}
                      url={mediaUrls[lesson.id]}
                      locked={locked}
                    />
                    <form
                      action={updateLesson.bind(null, lesson.id, course.id)}
                      className="space-y-3"
                    >
                      <fieldset disabled={locked} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="sm:col-span-2">
                            <span className="text-sm font-medium">Title</span>
                            <input
                              name="title"
                              defaultValue={lesson.title}
                              required
                              maxLength={150}
                              className={input}
                            />
                          </label>
                          <label>
                            <span className="text-sm font-medium">Type</span>
                            <select name="type" defaultValue={lesson.type} className={input}>
                              {lessonTypeOptions.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-sm font-medium">
                            {lesson.type === 'TEXT'
                              ? 'Lesson text'
                              : 'Notes or transcript (optional)'}
                          </span>
                          <textarea
                            name="body"
                            rows={lesson.type === 'TEXT' ? 8 : 4}
                            defaultValue={lesson.body ?? ''}
                            className={input}
                          />
                          <span className="block text-xs text-gray-500">
                            {lesson.type === 'TEXT'
                              ? 'Blank lines separate paragraphs; ## makes a heading, - a list, **bold**.'
                              : 'Shown below the video or PDF, for people who prefer to read, and used by the AI study help.'}
                          </span>
                        </label>
                        <div className="flex flex-wrap items-end gap-6">
                          <label>
                            <span className="text-sm font-medium">Length (minutes)</span>
                            <input
                              name="durationMinutes"
                              type="number"
                              min={0}
                              max={600}
                              defaultValue={Math.round(lesson.durationSeconds / 60)}
                              className={`${input} w-28`}
                            />
                          </label>
                          <label className="flex items-center gap-2 pb-2">
                            <input
                              type="checkbox"
                              name="isPreview"
                              defaultChecked={lesson.isPreview}
                            />
                            <span className="text-sm">Free preview</span>
                          </label>
                        </div>
                        {!locked && (
                          <button type="submit" className="btn-solid px-4 py-2 text-sm">
                            Save lesson
                          </button>
                        )}
                      </fieldset>
                    </form>

                    {!locked && (
                      <div className="flex gap-2">
                        <MoveButtons
                          label="lesson"
                          onUp={moveLesson.bind(null, lesson.id, course.id, 'up')}
                          onDown={moveLesson.bind(null, lesson.id, course.id, 'down')}
                          first={lIndex === 0}
                          last={lIndex === section.lessons.length - 1}
                        />
                        <form action={deleteLesson.bind(null, lesson.id, course.id)}>
                          <button
                            type="submit"
                            className={iconButton}
                            aria-label={`Delete lesson ${lesson.title}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ol>

          {!locked && (
            <form
              action={addLesson.bind(null, section.id)}
              className="flex flex-wrap gap-2 border-t border-gray-300 p-3"
            >
              <label htmlFor={`new-lesson-${section.id}`} className="sr-only">
                New lesson title
              </label>
              <input
                id={`new-lesson-${section.id}`}
                name="title"
                placeholder="New lesson title"
                required
                maxLength={150}
                className={`${input} min-w-48 flex-1`}
              />
              <select
                name="type"
                defaultValue="VIDEO"
                aria-label="Lesson type"
                className={`${input} w-auto`}
              >
                {lessonTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-outline px-4 py-2 text-sm">
                Add lesson
              </button>
            </form>
          )}
        </section>
      ))}

      {!locked && (
        <form action={addSection.bind(null, course.id)} className="flex flex-wrap gap-2">
          <label htmlFor="new-section" className="sr-only">
            New section title
          </label>
          <input
            id="new-section"
            name="title"
            placeholder="New section title"
            required
            maxLength={150}
            className={`${input} min-w-48 flex-1`}
          />
          <button type="submit" className="btn-solid px-4 py-2">
            Add section
          </button>
        </form>
      )}
    </div>
  );
}

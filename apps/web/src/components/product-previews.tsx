import { ArrowDown, ArrowUp, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { CourseTypeBadge, resourceTypes, TypeBadge } from '@/components/badges';
import { StatusBadge } from '@/components/status-badge';
import type { CourseSummary } from '@/lib/catalog/types';
import { formatDuration, plural } from '@/lib/format';
import type { ResourceSummary } from '@/server/resources';

// Pictures of the product for the home page hero, drawn from real courses and resources with the
// labels the real pages use. They are illustrations: hidden from screen readers, with no links.
// Their parts animate when their slide comes into view (see HeroCarousel).

const riseIn = 'motion-safe:group-data-[active=true]/slide:animate-rise-in';
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function PreviewWindow({ address, children }: { address: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden border border-gray-300 bg-white shadow-2xl shadow-black/10 select-none"
    >
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-4 py-3">
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="ml-3 truncate text-xs text-gray-500">livingwithkrishna.com{address}</span>
      </div>
      {children}
    </div>
  );
}

/** The lesson player, part way through a course. */
export function LessonPreview({ course }: { course: CourseSummary }) {
  const sections = course.sections.slice(0, 5);
  // Part way through: the middle section is the one being studied.
  const current = Math.floor((sections.length - 1) / 2);
  const done = sections.slice(0, current).reduce((sum, s) => sum + s.lessonCount, 0) + 1;
  const total = Math.max(course.lessonCount, done + 1);
  const percent = Math.round((done / total) * 100);

  return (
    <PreviewWindow address={`/learn/${course.slug}`}>
      <div className="grid sm:grid-cols-[1fr_13rem]">
        <div>
          <div className="relative flex aspect-video items-center justify-center bg-black">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand">
              <span className="ml-1 size-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-black" />
            </span>
            <span className="absolute bottom-4 left-4 text-xs text-white/80">
              Lesson {done + 1} of {total}
            </span>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <span className="block h-full w-1/3 bg-brand" />
            </span>
          </div>
          <div className="p-4">
            <p className="truncate font-semibold text-black">{sections[current]?.title}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
              <span className="h-2 w-28 shrink-0 bg-gray-200">
                <span
                  className="block h-full origin-left bg-brand motion-safe:group-data-[active=true]/slide:animate-grow-x"
                  style={{ width: `${percent}%` }}
                />
              </span>
              {done} of {plural(total, 'lesson')} complete
            </div>
          </div>
        </div>
        <div className="hidden border-l border-gray-200 sm:block">
          <p className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-black">
            Course content
          </p>
          <ul>
            {sections.map((section, i) => (
              <li
                key={section.title}
                className={`flex gap-2.5 px-4 py-2.5 text-xs ${i === current ? 'bg-orange-50' : ''}`}
              >
                {i < current ? (
                  <CheckCircle2
                    className={`size-4 shrink-0 text-brand-ink ${riseIn}`}
                    style={delay(300 + i * 250)}
                  />
                ) : i === current ? (
                  <PlayCircle className="size-4 shrink-0 text-black" />
                ) : (
                  <Circle className="size-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0">
                  <span
                    className={`block truncate ${i === current ? 'font-semibold text-black' : 'text-gray-800'}`}
                  >
                    {section.title}
                  </span>
                  <span className="text-gray-500">{plural(section.lessonCount, 'lesson')}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PreviewWindow>
  );
}

const exploreFilters = ['Everything', 'Videos', 'Audio', 'Articles', 'PDFs'];

/** The Explore page's list of free courses and teachings (up to four, courses first). */
export function FreeContentPreview({
  courses,
  resources,
}: {
  courses: CourseSummary[];
  resources: ResourceSummary[];
}) {
  const items = [
    ...courses.map((course) => ({
      id: course.slug,
      badge: <CourseTypeBadge className="w-20 shrink-0 justify-center" />,
      title: course.title,
      by: course.instructor,
      length: plural(course.lessonCount, 'lesson'),
    })),
    ...resources.map((resource) => ({
      id: resource.id,
      badge: <TypeBadge type={resource.type} className="w-20 shrink-0 justify-center" />,
      title: resource.title,
      by: resource.authorName,
      length:
        resource.minutes > 0 &&
        `${formatDuration(resource.minutes)} ${resourceTypes[resource.type].unit}`,
    })),
  ].slice(0, 4);

  return (
    <PreviewWindow address="/explore">
      <div className="p-5 sm:p-6">
        <p className="text-xl font-bold text-black">Explore free courses and teachings</p>
        <div className="mt-4 flex gap-2 overflow-hidden">
          {exploreFilters.map((filter, i) => (
            <span
              key={filter}
              className={`shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs font-medium ${
                i === 0
                  ? 'border-black text-black shadow-[0_3px_0_0_black]'
                  : 'border-transparent text-gray-600'
              }`}
            >
              {filter}
            </span>
          ))}
        </div>
        <ul className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
          {items.map((item, i) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 py-3.5 ${riseIn}`}
              style={delay(150 + i * 120)}
            >
              {item.badge}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-black">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-gray-500">{item.by}</span>
              </span>
              {item.length && (
                <span className="hidden shrink-0 text-xs text-gray-500 sm:block">
                  {item.length}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </PreviewWindow>
  );
}

/** An instructor's course in the course builder, sent for review. */
export function CourseBuilderPreview({ course }: { course: CourseSummary }) {
  return (
    <PreviewWindow address="/instructor">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Edit course</p>
            <p className="truncate text-xl font-bold text-black">{course.title}</p>
          </div>
          <span className={`shrink-0 ${riseIn}`} style={delay(700)}>
            <StatusBadge status="IN_REVIEW" />
          </span>
        </div>
        <p className="mt-5 text-sm font-bold text-black">Curriculum</p>
        <ul className="mt-3 space-y-2">
          {course.sections.slice(0, 4).map((section, i) => (
            <li
              key={section.title}
              className={`flex items-center gap-3 border border-gray-300 px-3 py-2.5 ${riseIn}`}
              style={delay(100 + i * 120)}
            >
              <span className="flex shrink-0 flex-col text-gray-400">
                <ArrowUp className="size-3" />
                <ArrowDown className="size-3" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black">
                {section.title}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {plural(section.lessonCount, 'lesson')}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-semibold text-gray-600">
          <span className="border border-dashed border-gray-400 py-2.5">Add lesson</span>
          <span className="border border-dashed border-gray-400 py-2.5">Add section</span>
        </div>
      </div>
    </PreviewWindow>
  );
}

import { ArrowRight, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CategoryPills, pillClass, pillRowClass } from '@/components/category-pills';
import { CourseGrid } from '@/components/course-card';
import { ResourceGrid } from '@/components/resource-card';
import type { ResourceType } from '@/generated/prisma/client';
import { getCategories, searchCourses } from '@/server/catalog';
import { listPublishedResources } from '@/server/resources';

export const metadata: Metadata = {
  title: 'Explore free courses and teachings',
  description:
    'Free courses, talks, kirtan recordings, articles and recipes, open to everyone. No subscription needed.',
};

const filters = [
  { value: undefined, label: 'Everything' },
  { value: 'courses', label: 'Free courses' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'ARTICLE', label: 'Articles' },
  { value: 'PDF', label: 'PDFs' },
] as const;
type Filter = (typeof filters)[number]['value'];

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Row({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{title}</h2>
          <p className="mt-1 text-gray-700">{subtitle}</p>
        </div>
        <Link href={href} className="flex items-center gap-1 font-semibold hover:text-brand">
          See all <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function ExplorePage({ searchParams }: PageProps<'/explore'>) {
  const params = await searchParams;
  const query = single(params.q)?.trim() || undefined;
  const filter = filters.find((f) => f.value === single(params.type))?.value as Filter;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === single(params.category))?.slug;
  const filtered = Boolean(query || filter || category);

  const wantCourses = !filter || filter === 'courses';
  const resourceTypes: ResourceType[] | undefined =
    filter && filter !== 'courses' ? [filter] : undefined;
  const [courses, resources] = await Promise.all([
    wantCourses ? searchCourses({ free: true, query, category }) : [],
    filter === 'courses' ? [] : listPublishedResources({ types: resourceTypes, category, query }),
  ]);

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: query, type: filter, category, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const qs = next.toString();
    return `/explore${qs ? `?${qs}` : ''}`;
  };

  const byType = (...types: ResourceType[]) => resources.filter((r) => types.includes(r.type));
  const videos = byType('VIDEO');
  const audio = byType('AUDIO');
  const reading = byType('ARTICLE', 'PDF');
  const total = courses.length + resources.length;

  return (
    <>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="font-semibold text-brand uppercase">Explore</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold md:text-5xl">
            Free courses and teachings, open to everyone
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-200">
            Watch talks, listen to kirtan, read articles and recipes, and take free courses at your
            own pace. No subscription needed.
          </p>
          <form action="/explore" role="search" className="relative mt-8 max-w-xl">
            {filter && <input type="hidden" name="type" value={filter} />}
            {category && <input type="hidden" name="category" value={category} />}
            <label htmlFor="explore-search" className="sr-only">
              Search free content
            </label>
            <input
              id="explore-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search free content..."
              className="w-full rounded-full border border-white bg-white py-3 pr-12 pl-5 text-black focus:ring-2 focus:ring-brand focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-black"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <nav aria-label="Filter by type" className={pillRowClass}>
            {filters.map((f) => (
              <Link
                key={f.label}
                href={href({ type: f.value })}
                aria-current={f.value === filter ? 'page' : undefined}
                className={pillClass(f.value === filter)}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          <CategoryPills
            categories={categories}
            active={category}
            query={query}
            basePath="/explore"
            keep={{ type: filter }}
          />
        </div>

        {total === 0 ? (
          <div className="bg-white p-10 text-center shadow-md">
            <p className="text-lg font-semibold">
              {filtered ? 'Nothing matches yet.' : 'Free content is on its way.'}
            </p>
            <p className="mt-2 text-gray-700">
              {filtered
                ? 'Try another search or type, or browse all courses.'
                : 'Our teachers are preparing free talks, recordings and courses. Meanwhile, browse the course catalogue.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {filtered && (
                <Link href="/explore" className="btn-outline">
                  Clear filters
                </Link>
              )}
              <Link href="/courses" className="btn-solid">
                Browse all courses
              </Link>
            </div>
          </div>
        ) : filtered ? (
          <section className="space-y-8">
            <p className="text-sm text-gray-600" aria-live="polite">
              {total} {total === 1 ? 'result' : 'results'}
              {query && <> for &ldquo;{query}&rdquo;</>}
            </p>
            {courses.length > 0 && (
              <div className="space-y-4">
                {resources.length > 0 && <h2 className="text-xl font-bold">Free courses</h2>}
                <CourseGrid courses={courses} />
              </div>
            )}
            {resources.length > 0 && (
              <div className="space-y-4">
                {courses.length > 0 && (
                  <h2 className="text-xl font-bold">Videos, audio and reading</h2>
                )}
                <ResourceGrid resources={resources} />
              </div>
            )}
          </section>
        ) : (
          <>
            {courses.length > 0 && (
              <Row
                title="Free courses"
                subtitle="Complete courses you can take today, free for everyone."
                href={href({ type: 'courses' })}
              >
                <CourseGrid courses={courses.slice(0, 6)} />
              </Row>
            )}
            {videos.length > 0 && (
              <Row
                title="Watch"
                subtitle="Talks, classes and demonstrations."
                href={href({ type: 'VIDEO' })}
              >
                <ResourceGrid resources={videos.slice(0, 6)} />
              </Row>
            )}
            {audio.length > 0 && (
              <Row
                title="Listen"
                subtitle="Kirtan, bhajans and recorded classes."
                href={href({ type: 'AUDIO' })}
              >
                <ResourceGrid resources={audio.slice(0, 6)} />
              </Row>
            )}
            {reading.length > 0 && (
              <Row
                title="Read"
                subtitle="Articles, guides and recipes."
                href={href({ type: 'ARTICLE' })}
              >
                <ResourceGrid resources={reading.slice(0, 6)} />
              </Row>
            )}
          </>
        )}

        <section className="flex flex-col items-center gap-4 bg-white p-10 text-center shadow-md">
          <h2 className="text-2xl font-extrabold">Ready to go deeper?</h2>
          <p className="max-w-xl text-gray-700">
            Our full courses guide you step by step, with progress tracking to keep you going.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/courses" className="btn-solid">
              Browse all courses
            </Link>
            <Link href="/plans-and-pricing" className="btn-outline">
              See plans
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

import type { ReactNode } from 'react';

/**
 * One hero slide: a headline, a line of text and an action beside a picture of the product.
 * The first slide on a page uses `h1`; later slides use `h2`.
 */
export function HeroSlide({
  heading,
  headingLevel: Heading = 'h2',
  text,
  action,
  visual,
}: {
  heading: string;
  headingLevel?: 'h1' | 'h2';
  text: string;
  action: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-5">
        <Heading className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-black sm:text-5xl">
          {heading}
        </Heading>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-700">{text}</p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">{action}</div>
      </div>
      {visual && <div className="min-w-0 lg:col-span-7">{visual}</div>}
    </div>
  );
}

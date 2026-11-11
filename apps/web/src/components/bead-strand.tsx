import type { ReactNode } from 'react';

/** Where the beads run, centred in the gutter beside each item. */
const strand = 'bead-strand absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 text-black';

export type BeadStrandItem = { id: string; content: ReactNode };

/**
 * A list strung on a strand of japa beads, after the mala on the coming-soon page, closed by the
 * saffron head bead and its tassel. The strand itself stays still; where it starts below the fold
 * (on phones) the contact page fades it in with its column.
 */
export function BeadStrand({ items, label }: { items: BeadStrandItem[]; label: string }) {
  return (
    <div>
      <ul aria-label={label}>
        {items.map((item) => (
          <li key={item.id} className="grid grid-cols-[2.5rem_1fr]">
            <span aria-hidden className="relative">
              <span className={strand} />
            </span>
            <div className="py-5 pl-4">{item.content}</div>
          </li>
        ))}
      </ul>
      <HeadBead />
    </div>
  );
}

/** The head bead that closes the strand, with its tassel (drawn as on the coming-soon page). */
function HeadBead() {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="188 370 24 88"
      width="32"
      height="119"
      className="ml-1 block"
    >
      <circle cx="200" cy="378" r="7.5" className="fill-brand" />
      <g className="fill-brand stroke-brand">
        <path d="M200 385.5V399" className="fill-none" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="200" cy="401.5" r="2.6" className="stroke-none" />
        <path
          d="M200 404L189.5 451M200 404L194 453.5M200 404L198.2 455M200 404L201.8 455M200 404L206 453.5M200 404L210.5 451"
          className="fill-none"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

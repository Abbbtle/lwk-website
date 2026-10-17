import { ChevronDown } from 'lucide-react';

/**
 * FAQ accordion (native details elements, so it works without scripts), on the page's board:
 * the heading on the left and the questions on the right on wider screens.
 */
export function Faq({
  items,
  heading = 'Frequently Asked Questions',
}: {
  items: { question: string; answer: string }[];
  heading?: string;
}) {
  return (
    <section className="page-width grid gap-8 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
      <h2 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl lg:col-span-4">
        {heading}
      </h2>
      <div className="divide-y divide-gray-300 border-y border-gray-300 lg:col-span-8">
        {items.map(({ question, answer }) => (
          <details key={question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-gray-900">
              {question}
              <ChevronDown
                className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <p className="mt-3 text-gray-700">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

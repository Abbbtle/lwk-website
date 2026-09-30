import { ChevronDown } from 'lucide-react';

/** POC FAQ accordion. */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <section className="px-6 py-16">
      <h2 className="text-center text-3xl font-semibold md:text-4xl">Frequently Asked Questions</h2>
      <div className="mx-auto mt-10 max-w-3xl divide-y divide-gray-300 border-b border-gray-300">
        {items.map(({ question, answer }) => (
          <details key={question} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg">
              {question}
              <ChevronDown
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
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

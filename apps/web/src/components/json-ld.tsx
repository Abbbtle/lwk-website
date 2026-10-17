/**
 * Structured data for search engines. `<` is escaped so text from the database can never close
 * the script element; the script is data (not run), so the Content Security Policy allows it.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

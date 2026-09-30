'use client';

// Last resort when the whole layout fails: plain HTML, no dependencies on the rest of the site.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1>Living With Krishna is having trouble</h1>
        <p>Please try again in a moment.</p>
        <button type="button" onClick={reset} style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}>
          Try again
        </button>
      </body>
    </html>
  );
}

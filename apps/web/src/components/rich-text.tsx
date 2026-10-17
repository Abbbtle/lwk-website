import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

// A small, safe Markdown subset for text written by instructors, admins and (later) the
// assistant: headings, paragraphs, lists, quotes, code, bold, italics and links. It builds React
// elements directly, so text can never inject HTML or scripts, and links only go to web
// addresses or pages on this site.

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      // "#" and "##" are section headings under the page title; "###" and "####" go below them.
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2] });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i].replace(LIST_ITEM, ''));
        i++;
        // A wrapped line belongs to the item above.
        while (
          i < lines.length &&
          lines[i].trim() &&
          /^\s{2,}/.test(lines[i]) &&
          !LIST_ITEM.test(lines[i])
        ) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        }
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !LIST_ITEM.test(lines[i]) &&
      !/^(#{1,4}\s|```|>)/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }
  return blocks;
}

/** Only web links and paths on this site; anything else is shown as plain text. */
export function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const INLINE =
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

function inline(text: string, keyPrefix = ''): ReactNode[] {
  const parts = text.split(INLINE).filter((part) => part !== '');
  return parts.map((part, index) => {
    const key = `${keyPrefix}${index}`;
    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    ) {
      return <strong key={key}>{inline(part.slice(2, -2), `${key}-`)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="bg-gray-100 px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      return href.startsWith('/') ? (
        <Link key={key} href={href} className="font-semibold underline hover:text-brand-ink">
          {link[1]}
        </Link>
      ) : (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-semibold underline hover:text-brand-ink"
        >
          {link[1]}
        </a>
      );
    }
    if (
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))) &&
      part.length > 2
    ) {
      return <em key={key}>{inline(part.slice(1, -1), `${key}-`)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const sizes = {
  // Lessons and articles.
  lg: {
    root: 'space-y-5 text-lg leading-relaxed text-gray-800',
    h2: 'pt-2 text-2xl font-bold text-gray-900',
    h3: 'pt-1 text-xl font-bold text-gray-900',
    h4: 'font-bold text-gray-900',
  },
  // Help text and chat messages.
  sm: {
    root: 'space-y-3 text-sm leading-relaxed',
    h2: 'text-base font-bold',
    h3: 'text-sm font-bold',
    h4: 'text-sm font-semibold',
  },
};

export function RichText({
  text,
  size = 'lg',
  className = '',
}: {
  text: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const style = sizes[size];
  return (
    <div className={`${style.root} ${className}`}>
      {parseBlocks(text).map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
            return (
              <Tag key={index} className={style[Tag]}>
                {inline(block.text)}
              </Tag>
            );
          }
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag
                key={index}
                className={`space-y-1.5 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item)}</li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={index} className="border-l-4 border-brand pl-4 text-gray-700 italic">
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {inline(line)}
                  </Fragment>
                ))}
              </blockquote>
            );
          case 'code':
            return (
              <pre key={index} className="overflow-x-auto bg-gray-100 p-3 font-mono text-sm">
                <code>{block.text}</code>
              </pre>
            );
          case 'rule':
            return <hr key={index} className="border-gray-300" />;
          case 'paragraph':
            return (
              <p key={index}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {inline(line)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

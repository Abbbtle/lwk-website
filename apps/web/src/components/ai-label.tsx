import { Sparkles } from 'lucide-react';

/** Marks AI-generated content as a draft to check. */
export function AiLabel({
  children = 'AI draft: check it before you use it.',
}: {
  children?: string;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-600">
      <Sparkles className="size-3.5 text-brand-ink" aria-hidden />
      {children}
    </p>
  );
}

/** Asks the assistant in the help panel a question (see HelpPanel). */
export const ASK_EVENT = 'lwk:ask';
export function askAssistant(question: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: question }));
}

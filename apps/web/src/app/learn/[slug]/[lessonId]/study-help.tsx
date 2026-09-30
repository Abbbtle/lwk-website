'use client';

import { CheckCircle2, MessageCircleQuestion, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { useState, useTransition } from 'react';
import { practiceQuiz } from '@/app/ai-actions';
import { AiLabel, askAssistant } from '@/components/ai-label';
import type { Quiz } from '@/server/ai/tools';

/** Study help under a lesson with text: a practice quiz, and questions for the assistant. */
export function StudyHelp({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load(fresh: boolean) {
    setError(null);
    start(async () => {
      const result = await practiceQuiz(lessonId, fresh);
      if ('error' in result) return setError(result.error);
      setQuiz(result.data);
      setAnswers({});
      setChecked(false);
    });
  }

  const score = quiz ? quiz.questions.filter((q, i) => answers[i] === q.answer).length : 0;

  return (
    <section
      aria-labelledby="study-help-title"
      className="max-w-3xl space-y-4 border border-gray-300 bg-white p-5"
    >
      <h2 id="study-help-title" className="flex items-center gap-2 text-lg font-bold">
        <Sparkles className="size-5 text-brand" aria-hidden /> Study help
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => load(false)}
          disabled={pending}
          className="btn-solid px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending && !quiz ? 'Making questions...' : 'Quiz me'}
        </button>
        <button
          type="button"
          onClick={() =>
            askAssistant(`Summarise the lesson "${lessonTitle}" in a few bullet points.`)
          }
          className="btn-outline px-4 py-2 text-sm"
        >
          Summarise
        </button>
        <button
          type="button"
          onClick={() =>
            askAssistant(
              `Explain the main idea of the lesson "${lessonTitle}" simply, with an example.`,
            )
          }
          className="btn-outline px-4 py-2 text-sm"
        >
          <MessageCircleQuestion className="size-4" aria-hidden /> Explain simply
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {quiz && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setChecked(true);
          }}
          className="space-y-5"
        >
          <AiLabel>
            Practice questions made by AI from this lesson. Tell us if one looks wrong.
          </AiLabel>
          {quiz.questions.map((q, i) => (
            <fieldset key={i} className="space-y-2">
              <legend className="font-semibold">
                {i + 1}. {q.question}
              </legend>
              {q.options.map((option, j) => {
                const chosen = answers[i] === j;
                const correct = q.answer === j;
                const tone = !checked
                  ? ''
                  : correct
                    ? 'border-green-700 bg-green-50'
                    : chosen
                      ? 'border-red-700 bg-red-50'
                      : '';
                return (
                  <label
                    key={j}
                    className={`flex cursor-pointer items-start gap-3 border border-gray-200 p-2.5 text-sm ${tone}`}
                  >
                    <input
                      type="radio"
                      name={`q${i}`}
                      checked={chosen}
                      disabled={checked}
                      onChange={() => setAnswers({ ...answers, [i]: j })}
                      className="mt-0.5 accent-black"
                    />
                    <span className="flex-1">{option}</span>
                    {checked && correct && (
                      <CheckCircle2 className="size-4 text-green-700" aria-label="Correct answer" />
                    )}
                    {checked && chosen && !correct && (
                      <XCircle className="size-4 text-red-700" aria-label="Your answer" />
                    )}
                  </label>
                );
              })}
              {checked && <p className="text-sm text-gray-700">{q.explanation}</p>}
            </fieldset>
          ))}
          {checked ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="font-semibold">
                You got {score} of {quiz.questions.length} right.
              </p>
              <button
                type="button"
                onClick={() => load(true)}
                disabled={pending}
                className="btn-outline px-4 py-2 text-sm disabled:opacity-60"
              >
                <RefreshCw className="size-4" aria-hidden />{' '}
                {pending ? 'Making new questions...' : 'New questions'}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={Object.keys(answers).length < quiz.questions.length}
              className="btn-solid px-4 py-2 text-sm disabled:opacity-50"
            >
              Check my answers
            </button>
          )}
        </form>
      )}
    </section>
  );
}

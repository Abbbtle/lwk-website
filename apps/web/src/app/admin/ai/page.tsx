import type { Metadata } from 'next';
import { requireRole } from '@/server/auth/session';
import { aiAvailable } from '@/server/ai/bedrock';
import { aiConfig } from '@/server/ai/config';
import { usageReport } from '@/server/ai/usage';
import { AdminHeading, AdminNav } from '../admin-nav';
import { AccessCheck } from './access-check';

export const metadata: Metadata = { title: 'AI', robots: { index: false } };

const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(value);

const featureLabels: Record<string, string> = {
  assistant: 'Help assistant',
  'access-check': 'Access checks',
  'lesson-helper': 'Study help',
  'course-outline': 'Course outlines',
  'course-writing': 'Writing help',
  'course-precheck': 'Review check',
  'application-summary': 'Application summaries',
  'support-draft': 'Support reply drafts',
};

export default async function AdminAiPage() {
  const session = await requireRole('admin', '/admin/ai');
  const config = aiConfig();
  const report = await usageReport();
  const percent = Math.min(
    100,
    Math.round((report.spendUsd / Math.max(0.01, report.capUsd)) * 100),
  );
  const maxDay = Math.max(0.0001, ...report.days.map((d) => d.costUsd));
  const outcomes = report.byOutcome as Record<string, number | undefined>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="AI" greeting={session.name} />
      <AdminNav current="/admin/ai" />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Spending this month</h2>
            <p className="mt-2 text-3xl font-extrabold">
              {usd(report.spendUsd)}{' '}
              <span className="text-lg font-semibold text-gray-600">of {usd(report.capUsd)}</span>
            </p>
            <div
              role="progressbar"
              aria-label="Share of the monthly AI budget used"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-3 w-full bg-gray-200"
            >
              <div
                className={`h-3 ${percent >= 90 ? 'bg-red-700' : 'bg-brand'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              AI features stop for the rest of the month at the cap; help articles and support keep
              working. Costs are estimates from token counts at list prices.
            </p>
            {report.spendUsd > 0 && (
              <ol className="mt-6 flex h-32 items-end gap-1" aria-label="Spend per day">
                {report.days.map((d) => (
                  <li
                    key={d.day.toISOString()}
                    className="flex-1"
                    title={`${d.day.toISOString().slice(0, 10)}: ${usd(d.costUsd)}, ${d.calls} calls`}
                  >
                    <div
                      className="bg-brand"
                      style={{ height: `${Math.max(2, (d.costUsd / maxDay) * 128)}px` }}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">By feature</h2>
            {report.byFeature.length === 0 ? (
              <p className="mt-3 text-gray-600">No AI use yet this month.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead className="text-xs text-gray-600 uppercase">
                  <tr>
                    <th className="py-2">Feature</th>
                    <th className="py-2">Calls</th>
                    <th className="py-2">Tokens in / out</th>
                    <th className="py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report.byFeature.map((f) => (
                    <tr key={f.feature}>
                      <td className="py-2">{featureLabels[f.feature] ?? f.feature}</td>
                      <td className="py-2">{f.calls}</td>
                      <td className="py-2">
                        {f.inputTokens.toLocaleString('en-GB')} /{' '}
                        {f.outputTokens.toLocaleString('en-GB')}
                      </td>
                      <td className="py-2 text-right">{usd(f.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-4 text-sm text-gray-600">
              {outcomes.ok ?? 0} answered · {outcomes.unavailable ?? 0} while AI was unavailable ·{' '}
              {outcomes.limited ?? 0} over a limit · {outcomes.error ?? 0} errors
            </p>
          </section>

          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">How people rated answers</h2>
            <p className="mt-1 text-sm text-gray-600">
              Only answers someone chose to rate are kept. Use &ldquo;not helpful&rdquo; ones to
              improve the help articles.
            </p>
            {report.feedback.length === 0 ? (
              <p className="mt-3 text-gray-600">No ratings yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {report.feedback.map((f) => (
                  <li
                    key={f.id}
                    className={`border-l-4 p-3 text-sm ${f.helpful ? 'border-green-700 bg-green-50' : 'border-red-700 bg-red-50'}`}
                  >
                    <p className="font-semibold">
                      {f.helpful ? 'Helpful' : 'Not helpful'} ·{' '}
                      {f.createdAt.toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {f.path && <span className="font-normal text-gray-600"> · on {f.path}</span>}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Q:</span> {f.question}
                    </p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-line text-gray-700">
                      <span className="font-semibold">A:</span> {f.answer}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-3 bg-white p-6 shadow-md text-sm">
            <h2 className="text-xl font-bold">Status</h2>
            <p>
              <span className="font-semibold">AI features:</span>{' '}
              {!config.enabled
                ? 'switched off'
                : aiAvailable()
                  ? 'on'
                  : 'on, but paused after an error (retrying soon)'}
            </p>
            <p>
              <span className="font-semibold">Assistant model:</span>{' '}
              <code className="break-all">{config.models.assistant}</code>
            </p>
            <p>
              <span className="font-semibold">Writing model:</span>{' '}
              <code className="break-all">{config.models.writer}</code>
            </p>
            <p>
              <span className="font-semibold">Region:</span> {config.region} (global inference
              routing)
            </p>
            <AccessCheck />
            <p className="text-gray-600">
              Models, the monthly cap and the on/off switch are settings in Parameter Store (AI_*
              under /lwk/&lt;stage&gt;/web); they apply after the next release.
            </p>
          </section>
          <section className="space-y-2 bg-white p-6 shadow-md text-sm">
            <h2 className="text-xl font-bold">Privacy</h2>
            <p className="text-gray-700">
              Questions go to Claude on Amazon Bedrock, which may process them in any AWS region
              (global routing) and does not store them or use them for training. Conversations stay
              in the person&apos;s browser; this site keeps only token counts, plus the question and
              answer when someone rates an answer or sends the conversation to support.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

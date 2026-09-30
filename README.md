# Living With Krishna

An online learning platform for Krishna consciousness courses. The build plan,
architecture and phases are in [docs/PLAN.md](docs/PLAN.md).

## Layout

- `apps/web` - Next.js 16 app (website and backend)
- `infra` - AWS CDK infrastructure (region `af-south-1`)

## Local setup

Requirements: Node 24 (`nvm use`), Postgres.app running PostgreSQL 18.

```bash
npm install                                     # also generates the Prisma client
cp apps/web/.env.example apps/web/.env.local   # then fill in both database URLs
npm run db:migrate -w @lwk/web                  # apply migrations to lwk_dev
npm run db:seed -w @lwk/web                     # load the sample catalogue
npm run dev                                     # http://localhost:3000
```

Useful endpoints: `/api/v1/health`, `/api/v1/categories`, `/api/v1/courses?q=&category=`,
`/api/v1/courses/:slug`, `/api/v1/resources?type=&q=` (Explore), `/api/v1/help?q=&path=`,
`/api/v1/me`, `/api/v1/me/export`, and `POST /api/v1/assistant` (streams the assistant's answer).

## Where things live

- Help centre articles: `apps/web/src/content/help.ts` (the assistant answers from these too).
- Sample content for testing: Admin > Explore > Load sample content (`SAMPLE_CONTENT=off`
  disables it).
- AI: `apps/web/src/server/ai/` (assistant, tools, metering). Admin > AI shows spend against the
  monthly cap and has a Check AI access button. See "Turning AI on" in docs/PLAN.md.
- Security: `apps/web/src/proxy.ts` (origin check, Content Security Policy, token refresh) and
  `apps/web/src/server/security/`. Admin actions are recorded in Admin > Activity log.

Sign-in uses the dev Cognito user pool (values in `apps/web/.env.example`). AWS access for
CDK and the CLI: `aws login --profile lwk`, then run commands with `--profile lwk` or
`AWS_PROFILE=lwk`. The app uses the same profile for Cognito and S3 calls, so run
`aws login --profile lwk` again when the 12-hour session expires.

After changing `prisma/schema.prisma`, run `npm run db:migrate -w @lwk/web` and then
`npm run db:generate -w @lwk/web` (Prisma 7 no longer regenerates the client when migrating),
and restart the dev server.

## Deploying

Merging into `dev` deploys to AWS automatically (`.github/workflows/deploy.yml`):
the site is at https://d1uih31m6ki5c2.cloudfront.net. Infrastructure changes are made
with CDK from `infra/` (`npm run diff` first, then `npm run deploy -- <stack>`).

Always deploy the monitoring stack with the alert address set, otherwise the email
subscription is removed: `ALERT_EMAIL=<address> npm run deploy -- lwk-dev-monitoring`.

Open a shell on the web server (no SSH): `aws ssm start-session --target <instance-id>
--profile lwk` (requires the Session Manager plugin). App logs: CloudWatch Logs group
`/lwk/dev/web`.

## Checks (same as CI)

```bash
npm run format:check
npm run lint
npm run typecheck
npm test          # uses TEST_DATABASE_URL (lwk_test)
npm run build
```

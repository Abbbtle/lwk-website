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
`/api/v1/courses/:slug`, `/api/v1/me`.

Sign-in uses the dev Cognito user pool (values in `apps/web/.env.example`). AWS access for
CDK and the CLI: `aws login --profile lwk`, then run commands with `--profile lwk` or
`AWS_PROFILE=lwk`. The app uses the same profile for Cognito and S3 calls, so run
`aws login --profile lwk` again when the 12-hour session expires.

After changing `prisma/schema.prisma`, run `npm run db:migrate -w @lwk/web`; the running dev
server picks up the regenerated client automatically.

## Deploying

Merging into `dev` deploys to AWS automatically (`.github/workflows/deploy.yml`):
the site is at https://d1uih31m6ki5c2.cloudfront.net. Infrastructure changes are made
with CDK from `infra/` (`npm run diff` first, then `npm run deploy -- <stack>`).

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

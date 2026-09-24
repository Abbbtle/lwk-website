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
`/api/v1/courses/:slug`.

## Checks (same as CI)

```bash
npm run format:check
npm run lint
npm run typecheck
npm test          # uses TEST_DATABASE_URL (lwk_test)
npm run build
```

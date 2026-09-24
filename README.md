# Living With Krishna

An online learning platform for Krishna consciousness courses. The build plan,
architecture and phases are in [docs/PLAN.md](docs/PLAN.md).

## Layout

- `apps/web` - Next.js 16 app (website and backend)
- `infra` - AWS CDK infrastructure (region `af-south-1`)

## Local setup

Requirements: Node 24 (`nvm use`), Postgres.app running PostgreSQL 18.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in DATABASE_URL
npm run dev                                     # http://localhost:3000
```

## Checks (same as CI)

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

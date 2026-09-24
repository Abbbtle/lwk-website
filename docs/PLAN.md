# Living With Krishna LMS - Build Plan

## Context

Living With Krishna (LWK) is a Udemy-style learning platform for the Hare Krishna
community: instructors publish courses (video, PDF, text lessons), students enroll,
learn, and track progress. The long-term scope comes from the SkyTrust proposal
(21.02.2025): user management with MFA, course authoring, DRM, admin/instructor/
moderator dashboards, forums, a headless CMS, payments, and native mobile apps.

We are building it ourselves from scratch in Next.js (the earlier Vite + React POC in
`lwk/` was retired; its logo and icon were kept), targeting an enterprise-grade
product hosted on AWS.

**Decisions made (Sept 2026):**

| Topic           | Decision                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| First milestone | Core web MVP (see Phase 1). Payments, quizzes, certificates, forums, DRM, CMS, mobile come later.                                       |
| Framework       | Next.js 16 (App Router) full-stack: pages, server components and `/api/v1` Route Handlers in one app; replaces the separate Express API |
| Hosting         | Next.js standalone Node server on one EC2 instance, PostgreSQL on RDS, CloudFront in front                                              |
| Payments        | Decide later (Paystack, PayFast and Stripe are the candidates)                                                                          |
| Domain          | None yet - use the CloudFront URL; add Route 53 + ACM certificate later                                                                 |

**AWS account facts (checked 2026-09-24):**

- Account `455280338092`, IAM user `kenneth`, on the **Free plan**: USD 100 credits
  (up to 100 more can be earned by completing AWS onboarding activities),
  plan expires **2027-03-24**. On the Free plan usage cannot exceed credits; when
  credits or time run out the account must be upgraded to the Paid plan or it is closed.
- Account is empty: no stacks, buckets, instances, databases or budgets.
- Free-plan-eligible EC2 types in `af-south-1`: t3.micro, t3.small, t4g.micro,
  t4g.small, c7i-flex.large. RDS: db.t3.micro / db.t4g.micro, Single-AZ only.
- In `af-south-1` (Cape Town): Cognito, RDS, EC2, SES, Secrets Manager, SSM are
  available. **MediaConvert is not** (relevant for the later DRM/HLS phase).

## Architecture (MVP)

```
Browser ──HTTPS──▶ CloudFront (xxxx.cloudfront.net)
                    ├── /_next/static/*  ▶ EC2 (immutable assets, cached at the edge)
                    ├── /*               ▶ EC2 t4g.micro (Next.js standalone server, Node 24, systemd)
                    └── /media/*         ▶ S3 media bucket (private, CloudFront signed URLs)

EC2 (public subnet, no SSH - SSM Session Manager only)
  ├── RDS PostgreSQL db.t4g.micro (private isolated subnet, Single-AZ, 20 GB gp3)
  ├── S3 via free gateway endpoint (presigned upload URLs for instructors)
  └── Cognito user pool (JWT verification with aws-jwt-verify)
```

- **Region:** `af-south-1` (Cape Town) for low latency to South African users.
  CloudFront caches static assets and media globally for users elsewhere.
- **Next.js full-stack:** server components read data through a `src/server/` service
  layer (Prisma, authorization checks) - never directly from components. Browser
  interactions and, later, the mobile apps use versioned Route Handlers under
  `/api/v1/*`, which call the same service layer. Keeping business logic out of
  React lets it be split into a separate API service later if scale demands it.
- **No NAT gateway** (saves ~USD 35/month): EC2 sits in a public subnet with a
  security group that only accepts traffic from the CloudFront origin-facing prefix
  list plus a secret origin header; RDS is in isolated subnets reachable only from EC2.
- **Auth:** Amazon Cognito user pool with email sign-up, optional TOTP MFA, and
  groups `student`, `instructor`, `admin` (`moderator` added with forums). Cognito
  managed login (auth code + PKCE); the Next.js server keeps the session in httpOnly
  cookies and verifies tokens server-side. Library choice (Amplify `adapter-nextjs`
  or Auth.js) is made in Phase 3. Mobile apps will send Cognito bearer tokens.
- **Media:** instructors upload directly to S3 with presigned (multipart) URLs; the
  API only stores object keys. Students stream via short-lived CloudFront signed URLs,
  issued only to enrolled users. MP4 for the MVP; HLS + encryption in the DRM phase.
- **Secrets:** RDS master password managed by RDS in Secrets Manager; the app reads
  it at runtime through its instance role. No secrets in the repo or `.env` in AWS.
- **Infrastructure as code:** AWS CDK (TypeScript) in `infra/`. No console clicking.

### Estimated monthly cost (to confirm with the pricing API before deploying)

EC2 t4g.micro ~8, public IPv4 ~3.65, EBS 8 GB ~1, RDS db.t4g.micro ~15, RDS storage
20 GB ~3, Secrets Manager 0.40, S3/CloudFront/Cognito ~0 at MVP volume.
**Roughly USD 30/month**, so USD 100 of credits lasts ~3 months once deployed.
Mitigations: build and test locally first (Phases 1-5), deploy only in Phase 6,
earn the extra onboarding credits, stop RDS when idle, and set budget alarms on day one.

## Repository layout

npm-workspaces monorepo, TypeScript throughout (set up in Phase 0):

```
apps/web/          Next.js 16 + React 19 + Tailwind CSS v4
  src/app/         routes (pages, layouts, /api/v1 Route Handlers)
  src/components/  UI components
  src/server/      service layer: Prisma, auth, business rules (Phase 2+)
infra/             AWS CDK app (TypeScript); cfn/budget.yaml for account guardrails
docs/              this plan
apps/mobile/       later: React Native / Expo app
packages/*         later: code shared between web and mobile
```

## Data model (Prisma, MVP)

- `User` - id (Cognito `sub`), email, displayName, avatarKey, createdAt
- `Category` - id, name, slug
- `Course` - id, slug, title, subtitle, description, thumbnailKey, language, level,
  categoryId, instructorId, status (`DRAFT` | `IN_REVIEW` | `PUBLISHED` | `ARCHIVED`),
  priceCents (nullable, unused until payments), publishedAt
- `Section` - id, courseId, title, position
- `Lesson` - id, sectionId, title, type (`VIDEO` | `PDF` | `TEXT`), mediaKey, body,
  durationSec, isPreview, position
- `Enrollment` - userId, courseId, enrolledAt (unique pair)
- `LessonProgress` - userId, lessonId, lastPositionSec, completedAt (unique pair)

Roles come from Cognito groups in the token, not the database.

## API (MVP, Route Handlers under `/api/v1`)

- Public: `GET /courses` (search, category, paging), `GET /courses/:slug`
  (curriculum, preview lessons), `GET /categories`, `GET /health`
- Student: `POST /courses/:id/enroll`, `GET /me/enrollments`,
  `GET /lessons/:id` (signed media URL if enrolled or preview),
  `PUT /lessons/:id/progress`, `GET /me/courses/:id/progress`
- Instructor: CRUD `/instructor/courses`, sections, lessons, reorder,
  `POST /instructor/uploads` (presigned multipart), `POST /instructor/courses/:id/submit`
- Admin: `GET /admin/courses?status=IN_REVIEW`, approve/reject,
  `GET /admin/users`, add/remove Cognito group

Pages that only read data (catalog, course detail, My Learning) load it in server
components through the service layer rather than calling these endpoints.

Cross-cutting: Zod validation, role checks in the service layer, structured JSON logs
(pino) to CloudWatch, security headers and a Content Security Policy, rate limiting,
consistent error format, `/api/v1/health` for monitoring.

## Web pages (MVP)

Home (hero, featured courses), Catalog with search/filter, Course detail
(curriculum, instructor, preview, Enroll), Sign in/up (Cognito), My Learning,
Lesson player (curriculum sidebar, video/PDF/text, resume, mark complete, progress bar),
Instructor dashboard and course editor (sections, lessons, uploads, submit for review),
Admin (review queue, user roles). Responsive and accessible (WCAG 2.1 AA target).

## Phases

**Phase 0 - Setup**

1. DONE - Node 24 (nvm), PostgreSQL 18 (Postgres.app, database `lwk_dev`, user `lwk`,
   connection string in `apps/web/.env.local`), AWS CLI v2 (installed per-user).
2. DONE - budget `lwk-monthly-cost` (USD 10/month, credits excluded; alerts at 50%
   forecast, 50% and 100% actual) via stack `lwk-guardrails` in `us-east-1`.
   **TODO (owner: Kenneth, in the AWS console): enable MFA on the root user and on
   IAM user `kenneth`** - neither has MFA, and `kenneth` has AdministratorAccess via
   group `Admins`. No access keys exist; local CLI access will use `aws login`.
3. DONE - monorepo with Next.js 16 in `apps/web`, CDK skeleton in `infra/`, Prettier,
   ESLint, GitHub Actions CI (format, lint, typecheck, build). Vitest is added in
   Phase 2 alongside the first server code.

**Phase 1 - Web foundation**
Layout (header, footer, mobile menu), design tokens (brand colours from the logo),
Home, Catalog and Course detail pages with mock data, loading and not-found states.

**Phase 2 - API and database (local)**
Prisma against local Postgres, migrations and seed data (sample courses), service
layer and public `/api/v1` course endpoints; pages switch from mock data to the
service layer. Vitest for unit and integration tests against a test database.

**Phase 3 - Authentication**
CDK `AuthStack` (Cognito user pool, app client, groups) deployed early because it
costs nothing at this scale. Sign-in/up/out, protected routes (Next.js proxy plus
server-side checks), role checks in the service layer; user record created on first
sign-in. Also sets up `aws login` and `cdk bootstrap` for `af-south-1`.

**Phase 4 - Instructor authoring and media**
CDK `StorageStack` (media bucket). Course editor, sections/lessons CRUD and
reordering, direct-to-S3 uploads, submit for review; admin review queue.

**Phase 5 - Learning experience**
Enrollment, My Learning, lesson player with signed URLs, progress tracking and resume.

**Phase 6 - Deploy to AWS**
CDK stacks: `NetworkStack` (VPC, 2 AZs, public + isolated subnets, S3 gateway
endpoint), `DataStack` (RDS PostgreSQL, automated backups 7 days, deletion protection),
`AppStack` (EC2 t4g.micro, Amazon Linux 2023, instance role, SSM, CloudWatch agent),
`WebStack` (CloudFront with EC2 origin, `/_next/static/*` and `/media/*` behaviors,
key group for signed URLs). Deploy: `next build` standalone output zipped to S3, then
SSM Run Command on the instance to unpack, run migrations and restart the service. CloudWatch alarms (5xx, CPU, RDS
storage, EC2 status). Then GitHub Actions deploys via OIDC role (no long-lived keys).

**Later phases (from the proposal)**

- Payments and paid enrollment (provider TBD), revenue dashboard
- Quizzes and assessments; automatic completion certificates (PDF)
- Discussion forums / Q&A with moderator role and content flagging
- Notifications and reminders (SES email, course calendars)
- Headless CMS for blog and announcements
- Content protection: HLS with AES-128 encryption, per-user visible watermark,
  device/session limits; full DRM (Widevine/FairPlay) needs a paid DRM provider and
  MediaConvert in a supported region (for example `eu-west-1`)
- Analytics and custom reports for admins and instructors
- Mobile apps (React Native / Expo) using the same API
- Scale-out: containers on ECS Fargate behind an ALB, RDS Multi-AZ, WAF

## Verification

- Every phase: `npm run format:check`, `npm run lint`, `npm run typecheck`,
  `npm test` (from Phase 2) and `npm run build` pass locally and in CI.
- Phases 1-5: run `npm run dev` locally and walk through the flows in a browser:
  sign up, become instructor, create course with a video, submit, approve as admin,
  enroll as a second user, watch, see progress persist after reload.
- Server: Vitest integration tests of the service layer and Route Handlers against a
  test Postgres database,
  including authorization tests (student cannot edit courses, non-enrolled user
  cannot get a media URL).
- Phase 6: `cdk synth` and `cdk diff` reviewed before every `cdk deploy`; after
  deploy, repeat the end-to-end walkthrough on the CloudFront URL, confirm `/api/v1/health`,
  confirm the RDS instance is not publicly accessible and EC2 accepts no direct
  traffic, and check the budget and cost explorer after 48 hours.

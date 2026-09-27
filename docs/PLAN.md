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
| Git flow        | Feature branch -> `dev` -> `uat` -> `main`. Pull requests always target `dev` first.                                                    |
| Design          | Follow the earlier POC at https://livingwithkrishna.netlify.app (see "Reference POC" below)                                             |

## Reference POC

The earlier POC (Vite + React Router + Auth0, hosted on Netlify) is the design and
content reference: https://livingwithkrishna.netlify.app

- **Look:** saffron/orange accent (Tailwind `orange-500` `#f97316`) on white and light
  gray, gray-800 text, Poppins font, light and dark logo variants, Swiper carousels,
  a scrolling marquee, Framer Motion animations, FAQ accordion.
- **Pages:** Home (hero "Rediscover Devotion - Experience Bhakti Yoga like never
  before", category carousel for Kirtan / Prasadam / Sastra, course grid,
  "Become An Instructor" call to action), Explore (course catalog with search),
  Categories, Plans & Pricing, Become an Instructor, Our Mission, Contact, Log In /
  Sign Up.
- **Categories and sample courses:** Kirtan (Kirtan Basics, Mastering Harmonium,
  Advanced Kirtan Techniques, History of Kirtan, Kirtan Leadership), Prasadam
  (Prasadam Cooking, Vegetarian Delights, Ayurvedic Recipes, Healthy Cooking,
  Spiritual Meals), Vaisnava Etiquette (Intro to Vaisnava Etiquette, Respect and
  Devotion, Daily Devotional Practices, Advanced Vaisnava Manners, Etiquette in the
  Temple), Sastra Study (Bhagavad Gita Deep Dive, Upanishads Study, Vedic Literature
  Overview, Sacred Texts Mastery, Philosophy of Bhakti).
- **The POC's business model is subscriptions,** not per-course purchases: Solo,
  Group and Classroom plans, monthly or annual billing, 14-day free trial. **Open
  question for the payments phase:** subscriptions only, per-course purchases, or both.
  The data model keeps both possible.
- **Instructor application form:** legal and initiated name, contact details,
  nationality, expertise, years of experience, degree, certifications, work and
  teaching experience, languages, motivation, teaching philosophy, strengths. This
  becomes the instructor onboarding flow (apply -> admin approves -> instructor role).
- **Contact form:** name, email, company, nature of inquiry (general, support,
  partnership, feedback, other), message; support@livingwithkrishna.org.
- The POC's photos (kirtan, sacred books, temple and prasadam scenes) need usage
  permission confirmed before they appear on the public site.

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
   **TODO (AWS console): enable MFA on the root user and on
   IAM user `kenneth`** - neither has MFA, and `kenneth` has AdministratorAccess via
   group `Admins`. No access keys exist; local CLI access will use `aws login`.
3. DONE - monorepo with Next.js 16 in `apps/web`, CDK skeleton in `infra/`, Prettier,
   ESLint, GitHub Actions CI (format, lint, typecheck, build). Vitest is added in
   Phase 2 alongside the first server code.

**Phase 1 - Web foundation**
Rebuild the POC's look in Next.js: saffron design tokens, Poppins, header with
mobile menu, footer; Home, Explore (catalog with search and category filter), Course
detail, Categories, Our Mission, Plans & Pricing (static), Contact and Become an
Instructor pages (forms render and validate; submission is wired up in Phases 2-4).
POC categories and courses as mock data; loading and not-found states.

Status: DONE. Pages live under `apps/web/src/app`; sample catalogue in
`src/lib/catalog` (async queries, swapped for Prisma in Phase 2); form schemas in
`src/lib/forms` (reused by Phase 4 when submissions are stored). Log In and Sign Up
show a "coming soon" page until Phase 3. Course covers are placeholders until images
are uploaded (Phase 4) or the POC photos are cleared for use.

**Phase 2 - API and database (local)**
Prisma against local Postgres, migrations and seed data (sample courses), service
layer and public `/api/v1` course endpoints; pages switch from mock data to the
service layer. Vitest for unit and integration tests against a test database.

Status: DONE.

- Prisma **7.10.0** pinned (npm `latest` pointed at an 8.0 release candidate); client
  generated into `src/generated/prisma` on install. Schema in `apps/web/prisma/`:
  categories, courses, sections, lessons (snake_case, UUIDv7 keys). Seed data in
  `prisma/seed-data.ts`; `npm run db:seed -w @lwk/web` is idempotent.
- Service layer `src/server/catalog.ts` (published courses only); pages render per
  request via `connection()`. Next step for performance: Cache Components
  (`'use cache'` plus tag revalidation when a course is published, Phase 4).
- `/api/v1/health`, `/categories`, `/courses`, `/courses/:slug` with the
  `{ data }` / `{ error: { code, message } }` envelope.
- Tests: Vitest against `lwk_test` (locally) or a PostgreSQL 18 service container (CI).
  Prisma 7 blocks `migrate reset` for AI agents, so test setup uses
  `migrate deploy` + `TRUNCATE` + seed instead.

**Phase 3 - Authentication**
CDK `AuthStack` (Cognito user pool, app client, groups) deployed early because it
costs nothing at this scale. Sign-in/up/out, protected routes (Next.js proxy plus
server-side checks), role checks in the service layer; user record created on first
sign-in. Also sets up `aws login` and `cdk bootstrap` for `af-south-1`.

Status: DONE.

- Stack `lwk-dev-auth` (af-south-1): user pool `af-south-1_vNL5Ybi4T` (Essentials plan,
  email sign-in, optional TOTP MFA, deletion protection, retained on stack delete),
  groups `admin` and `instructor`, managed login at
  `https://livingwithkrishna-dev.auth.af-south-1.amazoncognito.com`, public web client
  `2h3omuejks8avr9gjpdm9q3d9b` (code + PKCE, SRP only, rotation and revocation, 15-minute
  access/ID tokens, 30-day refresh). Stage settings in `infra/lib/config.ts`.
- Backend-for-frontend: `/auth/login`, `/auth/signup`, `/auth/callback`, `/auth/logout`
  (`src/app/auth`); tokens only in HttpOnly cookies; `src/proxy.ts` refreshes access
  tokens; `src/server/auth/session.ts` verifies tokens on every request (aws-jwt-verify)
  and provides `requireSession` / `requireRole`. `users` table keyed by Cognito `sub`.
- Verified end to end with a real test user in headless Chrome (16 checks, including
  refresh-token rotation, role changes and revocation on sign-out); test user deleted.
- Grant a role: `aws cognito-idp admin-add-user-to-group --user-pool-id
af-south-1_vNL5Ybi4T --username <email> --group-name admin --profile lwk` (takes effect
  on the next token refresh, within 15 minutes). An admin UI for this comes in Phase 4.
- Follow-ups: brand the hosted sign-in pages (LWK logo and POC colours via managed login
  branding); send Cognito email through SES before launch (the built-in sender has a low
  daily limit); in-app MFA enrollment page; Content Security Policy with nonces (Phase 6);
  bearer-token support in `/api/v1` for the mobile apps; decide whether admins must use MFA.

**Phase 4 - Instructor onboarding, authoring and media**
Instructor applications (POC form) stored and reviewed by admins; approval adds the
`instructor` group. CDK `StorageStack` (media bucket). Course editor, sections/lessons
CRUD and reordering, direct-to-S3 uploads, submit for review; admin review queue.
Contact form submissions stored for admins (email notifications come with SES later).

Status: DONE.

- Contact messages and instructor applications stored; applying needs an account;
  admins approve (adds the Cognito `instructor` group, then records the decision) or
  decline with a note. Admin area: overview, Courses, Instructor applications, Messages.
- Course editor (`/instructor`): drafts with unique slugs (fixed after first
  publication), sections and lessons (video, PDF, text) with reordering, free previews,
  cover image, review checklist, submit / withdraw. Instructors edit only their own
  drafts; admins can edit any course.
- Review queue (`/admin/courses`): publish, return with a required note, unpublish.
  Decisions are conditional updates, so stale pages cannot overwrite newer decisions.
- Stack `lwk-dev-storage`: private bucket `lwk-dev-media-455280338092` (encrypted, TLS
  1.2+, CORS for app origins, retained on delete). Browsers upload with presigned POST
  (S3 enforces key, type and size: video 2 GB, PDF 100 MB, cover 5 MB); uploads are
  verified before attaching; replaced or orphaned files are deleted. Previews and covers
  use short-lived signed S3 links until CloudFront (Phase 6).
- The app calls AWS (Cognito groups, S3) with the `lwk` profile locally
  (`AWS_PROFILE=lwk` in `.env.local`) and will use the EC2 instance role in AWS (Phase 6
  must grant `cognito-idp:AdminAddUserToGroup` and S3 object access on the media bucket).
- Verified end to end in headless Chrome with two temporary Cognito users (17 checks:
  contact inbox, application and approval, course with a real S3 video and cover,
  review, publishing, public search and course page); all test data removed afterwards.
- Follow-ups: email notifications (applicant decision, course returned or published,
  new contact message) once SES is set up; multipart uploads for videos over 2 GB;
  video transcoding and streaming (HLS) in the content-protection phase; an admin UI to
  manage roles directly.

**Phase 5 - Learning experience**
Enrollment, My Learning, lesson player with signed URLs, progress tracking and resume.

Status: DONE.

- `enrollments` and `lesson_progress` tables. Enrollment is free during early access (the
  course page shows the price struck through with "Free during early access").
- Access: free-preview lessons open to everyone; all lessons for enrolled learners, the
  course owner and admins. Media links (3-hour signed S3 URLs) are only issued for lessons
  the viewer may open.
- Player (`/learn/<course>/<lesson>`): video resumes at the saved position, saves every 15
  seconds and on pause, completes on end; PDF inline; text lessons; mark complete / undo;
  curriculum sidebar with completed and locked states; previous / next.
  `/learn/<course>` resumes at the first unfinished lesson.
- My Learning with progress and `GET /api/v1/me/enrollments`.
- Verified end to end with a temporary learner and a test course holding a real MP4 and
  PDF in S3 (16 checks, including resume at the saved position); test data removed.
- Known limitation until the content-protection phase: a signed media link can be
  shared while it is valid (3 hours). HLS with encryption, watermarking and CloudFront
  signed cookies address this later.
- The core web MVP (Phases 1-5) is complete; Phase 6 deploys it to AWS.

**Phase 6 - Deploy to AWS**
CDK stacks: `NetworkStack` (VPC, 2 AZs, public + isolated subnets, S3 gateway
endpoint), `DataStack` (RDS PostgreSQL, automated backups 7 days, deletion protection),
`AppStack` (EC2 t4g.micro, Amazon Linux 2023, instance role, SSM, CloudWatch agent),
`WebStack` (CloudFront with EC2 origin, `/_next/static/*` and `/media/*` behaviors,
key group for signed URLs). Deploy: `next build` standalone output zipped to S3, then
SSM Run Command on the instance to unpack, run migrations and restart the service. CloudWatch alarms (5xx, CPU, RDS
storage, EC2 status). Then GitHub Actions deploys via OIDC role (no long-lived keys).

Status: infrastructure DEPLOYED; first release goes out when this phase is merged into
`dev`. What was built (differences from the outline above in bold):

- `lwk-dev-network`: VPC `10.40.0.0/16`, 2 AZs, public + isolated subnets, no NAT, S3
  gateway endpoint. Security groups: web accepts port 3000 only from the CloudFront
  origin-facing prefix list (`pl-c0aa4fa9`); database accepts 5432 only from web.
- `lwk-dev-data`: PostgreSQL 18.3, db.t4g.micro, Single-AZ, 20 GB gp3 (auto-grows to 50),
  encrypted, private, deletion protection, final snapshot on delete, **RDS-managed
  master password in Secrets Manager (rotated by RDS)**. **Backups: 1 day** - the AWS
  Free plan rejects longer retention; raise to 7+ days after upgrading to the Paid plan.
- `lwk-dev-app` (**server and CloudFront in one stack**, since each needs the other):
  t4g.micro Amazon Linux 2023, IMDSv2, encrypted disk, no SSH (Session Manager), Elastic
  IP, CloudFront `https://d1uih31m6ki5c2.cloudfront.net` (pages uncached with all viewer
  headers forwarded; `/_next/static/*` cached), artifacts bucket (30-day expiry), log group
  `/lwk/dev/web` (30 days), runtime config in Parameter Store `/lwk/dev/web/*`. The app
  reads the database password from Secrets Manager at connect time (cached 1 minute) and
  verifies the RDS TLS certificate.
- `lwk-dev-deploy-access`: GitHub OIDC provider and role `lwk-dev-github-deploy`, trusted
  only for `refs/heads/dev` of this repository; it can upload bundles, run commands on
  the web server and read the app stack's outputs.
- Deploy: `.github/workflows/deploy.yml` on push to `dev` - build on `ubuntu-24.04-arm`,
  `deploy/build-bundle.sh`, upload, `deploy/instance/activate.sh` via SSM (config,
  migrations, switch release, health check, automatic rollback), then a health check
  through CloudFront. The four course categories now come from a migration; sample
  courses stay local-only.
- **Media is still served with signed S3 links**; a CloudFront media behaviour with
  signed URLs or cookies moves to the content-protection phase.
- Cost: about USD 32/month (Pricing API, Sept 2026). Budget raised to USD 40/month.
- **Known limitation: CloudFront reaches the server over plain HTTP** (only CloudFront
  IPs may connect). Before public launch: register a domain, put CloudFront on it with
  an ACM certificate and give the origin its own TLS certificate.
- Next: CloudWatch alarms (EC2 status check with auto-recovery, RDS CPU and free
  storage, app errors) with email notifications.

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

## Branches and environments

- `dev` - integration branch; every pull request targets it. CI must pass.
- `uat` - promoted from `dev` for user acceptance testing.
- `main` - production; promoted from `uat`.
- GitHub ruleset "Protected branches" (active) on all three: pull request required
  (0 approvals while there is one developer; raise to 1 when the team grows), `check`
  status must pass, force pushes and deletion blocked, no bypass.
- AWS environments: while on the Free plan there is **one** AWS environment (deployed
  from `dev` or `uat`); each additional environment costs roughly another USD 30/month.
  Separate `uat` and `prod` stacks (ideally separate AWS accounts under AWS
  Organizations) are added before public launch.

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

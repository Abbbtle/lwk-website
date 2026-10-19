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

**Decisions made (Sept 2026, updated Oct 2026):**

| Topic           | Decision                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| First milestone | Core web MVP (see Phase 1). Payments, quizzes, certificates, forums, DRM, CMS, mobile come later.                                       |
| Framework       | Next.js 16 (App Router) full-stack: pages, server components and `/api/v1` Route Handlers in one app; replaces the separate Express API |
| Hosting         | Next.js standalone Node server on one EC2 instance, PostgreSQL on RDS, CloudFront in front                                              |
| Payments        | Paystack for South Africa first; a merchant of record (Paddle, else Lemon Squeezy) for other countries. Built in Phase 14               |
| Pricing         | Membership first, with regional prices; single courses too, in five tiers. One price matrix in `apps/web/src/lib/pricing` (Phase 13)    |
| Domain          | None yet - use the CloudFront URL; add Route 53 + ACM certificate later                                                                 |
| Git flow        | Feature branch -> `dev` -> `uat` -> `main`. Pull requests always target `dev` first.                                                    |
| Design          | Follow the earlier POC at https://livingwithkrishna.netlify.app (see "Reference POC" below)                                             |
| AI              | Claude on Amazon Bedrock (IAM-authenticated, billed to the AWS account); the site enforces a USD 5/month AI spending cap during UAT     |
| Free content    | An Explore section holds free courses and free resources (videos, audio, articles, PDFs) open to everyone                               |

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
  Group and Classroom plans, monthly or annual billing, 14-day free trial. **Decided
  (Oct 2026): both** - Membership first, with single courses too; Membership, Family and
  Community plans replace the POC's plans (see Phase 13).
- **Instructor application form:** legal and initiated name, contact details,
  nationality, expertise, years of experience, degree, certifications, work and
  teaching experience, languages, motivation, teaching philosophy, strengths. This
  becomes the instructor onboarding flow (apply -> admin approves -> instructor role).
- **Contact form:** name, email, company, nature of inquiry (general, support,
  partnership, feedback, other), message; the POC listed support@livingwithkrishna.org, a
  domain the project does not own, so the site uses support@livingwithkrishna.com.
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
  isFree and priceTier (1-5), read together as one pricing: free, a tier or unpriced (Phase 13;
  replaced the deprecated priceCents), publishedAt
- `Section` - id, courseId, title, position
- `Lesson` - id, sectionId, title, type (`VIDEO` | `PDF` | `TEXT`), mediaKey, body,
  durationSec, isPreview, position
- `Enrollment` - userId, courseId, enrolledAt (unique pair)
- `LessonProgress` - userId, lessonId, lastPositionSec, completedAt (unique pair)
- `CourseAccess` - userId, courseId, source (`PURCHASE` | `GIFT` | `ADMIN`) (unique together),
  grantedAt, revokedAt: lifetime access to a course, one row per source (Phase 14a)
- `Membership` - payerId, plan, the price charged (region, currency, amount in minor units),
  status (`TRIALING` | `ACTIVE` | `PAST_DUE` | `EXPIRED`), trialEndsAt, currentPeriodEnd,
  cancelAtPeriodEnd, provider codes (Phase 14a)
- `MembershipSeat` - membershipId, userId and acceptedAt (set together on acceptance),
  invitedEmail: Family and Community seats (Phase 14a)

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
- Custom sign-in pages (`/login`, `/sign-up`, `/forgot-password`) replaced the hosted
  pages: SRP in the browser (password never reaches the server), tokens handed to
  `POST /auth/session` (same-origin only) and kept in HttpOnly cookies; branded
  verification email.
- Log out asks for confirmation in an accessible dialog (Cancel has focus; Esc or a click
  outside closes it; without JavaScript the button logs out directly). An optional "also
  log me out on my other devices" calls Cognito `GlobalSignOut`; otherwise only this
  device's refresh token is revoked. Both end on a `/logged-out` page.
- Follow-ups: send Cognito email through SES before launch (the built-in sender has a low
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
- `lwk-dev-app` (**server and CloudFront in one stack**: the distribution needs the server's
  address and origin secret, and moving the deployed distribution would replace its address):
  t4g.micro Amazon Linux 2023, IMDSv2, encrypted disk, no SSH (Session Manager), Elastic
  IP, CloudFront at `https://dev.livingwithkrishna.com` (certificate from `lwk-dev-edge` in
  us-east-1; the distribution's own address `https://d1uih31m6ki5c2.cloudfront.net` redirects
  there; pages uncached with all viewer headers forwarded; `/_next/static/*` cached; every
  response marked `X-Robots-Tag: noindex, nofollow`), artifacts bucket (30-day expiry), log group
  `/lwk/dev/web` (30 days), runtime config in Parameter Store `/lwk/dev/web/*`. The app
  reads the database password from Secrets Manager at connect time (cached 1 minute) and
  verifies the RDS TLS certificate.
- `lwk-dev-deploy-access`: GitHub OIDC provider and role `lwk-dev-github-deploy`, trusted
  only for `refs/heads/dev` of this repository; it can upload bundles, run commands on
  the web server and read the app stack's outputs. The GitHub OIDC provider is account-wide (IAM allows
  one per issuer): the coming-soon publish role trusts it too, so do not destroy this stack while
  `lwk-coming-soon` exists. A second stage in this account needs an account-level owner for the
  provider first (`bin/lwk.ts` refuses to synthesize one).
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
- Monitoring (`lwk-dev-monitoring`, DONE): SNS topic `lwk-dev-alerts` emailing the
  address given at deploy time; 8 alarms (free tier) - EC2 system check (automatic
  recover), instance check (automatic reboot), CPU credits, site down (a Lambda checks
  `/api/v1/health` through CloudFront every 5 minutes; missing data counts as down), app
  errors from the log group, RDS CPU, free storage and freeable memory.
- The web server AMI is pinned in `infra/lib/config.ts`; updating it rebuilds the server.

**Phase 7 - Security, roles and accounts**
Hardening before wider testing, admin management of people and roles, and self-service
account settings.

Status: DONE (the infrastructure part is deployed separately, see below).

- Only our CloudFront distribution can reach the server: CloudFront adds a secret header
  (`X-Origin-Verify`, value generated by Secrets Manager as `lwk/<stage>/origin-verify` and
  referenced by CloudFormation, never written anywhere) and `src/proxy.ts` refuses requests
  without it. `/api/v1/health` stays open for the deploy script's local check.
- Content Security Policy with a fresh nonce per response (`src/server/security/csp.ts`):
  only scripts the server rendered can run; media, uploads and Cognito origins are listed
  explicitly; framing is refused. Also `Cross-Origin-Opener-Policy: same-origin` and
  `/.well-known/security.txt`.
- Rate limits in PostgreSQL (`rate_limits`, fixed windows per IP or user): sign-in
  completions, contact form (5 an hour per IP, plus a honeypot field), instructor
  applications, profile changes, data exports. The visitor IP comes from CloudFront's
  `CloudFront-Viewer-Address` header (origin request policy
  `AllViewerAndCloudFrontHeaders-2022-06`).
- Sessions follow account changes immediately: `users` mirrors Cognito roles and two-step
  status; tokens issued before `roles_changed_at` use the stored roles, and tokens issued
  before `sessions_valid_after` (sign-out everywhere, disabled account) are rejected. Role
  grants no longer wait for the 15-minute token refresh.
- Admins must use two-step verification (authenticator app): without it the admin role is
  held but locked, and admin pages send them to set it up (Phase 9 extends this to the
  support role; `REQUIRE_STAFF_MFA=false` turns it off for local experiments only).
- Admin area: Users (search, filters, detail page with roles, disable/enable, sign out
  everywhere, reset two-step verification; guards against removing your own admin role or
  the last admin) and an append-only Activity log (`audit_events`) covering role and
  account changes, application and course review decisions, and self-service changes.
- Account area (`/account`): display name, two-step verification setup with a QR code
  (generated in the browser), password change (optionally logging out everywhere), log out
  everywhere, download my data (JSON), delete my account (typed confirmation plus the
  password again, verified on the server through the fresh token's `auth_time`; blocked for
  instructors with courses and for the last admin). Password checks stay in the browser (SRP).
- Instance role gained the Cognito admin actions used above (list, add and remove groups, get,
  disable and enable users, global sign-out, reset MFA). The app degrades gracefully until
  they exist.
- Verified in headless Chrome with temporary users (31 checks, including the CSP on every
  page, the admin two-step setup and login with generated codes, immediate role changes,
  disabling, password change, export and deletion); test data removed.
- Deploy: `npx cdk deploy lwk-dev-app --exclusively` from `infra/` with the `lwk` profile
  (secret, CloudFront header and origin request policy, IAM). Safe before or after the app
  release: the app only checks the header once `ORIGIN_SECRET_ARN` is in Parameter Store.

**Phase 8 - Explore: free content**
A free-content hub, as the POC's Explore link intended, with admin tools and sample content
for UAT.

Status: DONE.

- `/explore`: free courses plus free resources (videos, audio, articles, PDFs) open to
  everyone without signing in; search, type and category filters, rows for Free courses /
  Watch / Listen / Read, empty rows hidden. Resource pages (`/explore/<slug>`) play video
  and audio, show PDFs inline or render articles, with related content.
- The full course catalogue moved from `/explore` to `/courses` (header search, category
  links and the home page point there) with a "Free courses only" filter. Main menu: Explore,
  Courses, Categories, Plans & Pricing, Become an Instructor, Contact.
- Courses have `is_free` (instructors tick "Offer this course for free"; the admin review
  shows it) and free courses say "Free for everyone". Resources are a new `resources` table
  managed by admins in Admin > Explore (draft, uploads straight to S3 under `resources/`,
  publish checklist, unpublish, delete with files). Audio uploads (MP3, M4A, OGG, 500 MB)
  were added to the media rules. `GET /api/v1/resources` and `/api/v1/resources/:slug`.
- Text lessons, course descriptions and articles use a small safe Markdown subset
  (`src/components/rich-text.tsx`: headings, lists, quotes, code, bold, italics, links to
  web addresses or site pages); it builds React elements, so text cannot inject HTML.
- Sample content for UAT (`src/server/sample-content.ts`): four short text courses (two
  free) and four articles, taught by "LWK Team" and marked "Sample" wherever they appear.
  Admins load or remove all of it in Admin > Explore; `SAMPLE_CONTENT=off` disables the
  tool (set it for production).
- Verified in headless Chrome (27 checks: empty state, loading samples, filters and search,
  formatted articles and lessons, the catalogue move, free course page, publishing a PDF and
  a video with real S3 uploads, public API, phone layout, removing samples, deleting files,
  no CSP violations); test data removed.

**Phase 9 - Help and support**
Help wherever people are, and a person when they need one.

Status: DONE (the `support` Cognito group is deployed with the auth stack, see below).

- Help centre (`/help`): 27 short articles in `src/content/help.ts` (reviewed like code),
  grouped in six topics, with search (`src/lib/help.ts`), related articles and "Was this
  helpful?" feedback (`help_feedback`; the support inbox shows the least helpful articles and
  what people were looking for). Staff-only articles are hidden from others.
- Help panel on every page (the Help button): articles about the current page (each article
  lists the paths it covers), instant search, popular questions, and links to the help
  centre, "Report a problem" (prefilled category and page) and "Contact support". The AI
  assistant joins this panel in Phase 10.
- Support requests (`support_tickets`, `support_messages`; references start at #1001):
  people choose a category and describe the problem, see matching articles while typing,
  and follow the conversation at `/support`. Staff work from Admin > Support: views (open,
  waiting for them, assigned to me, resolved, closed), search by number, subject, name or
  email, replies (with templates) that notify the person, internal notes, status, priority
  and assignment. A reply from the person reopens the request.
- New `support` role (Cognito group, precedence 15): the support inbox without the rest of
  the admin area. Admin and support are staff roles and both require two-step verification
  (`REQUIRE_STAFF_MFA=false` turns this off for local experiments only).
- In-app notifications (`notifications`, the bell in the header and `/notifications`):
  support replies and resolutions, instructor application decisions, course published /
  returned / unpublished, roles given or removed, requests assigned to staff.
- Getting-started checklists worked out from real progress, for learners (My Learning),
  instructors (dashboard) and admins (overview); each can be hidden (`users.dismissed_tips`).
- Contextual help links in the lesson player, course editor, instructor dashboard and
  application page; a skip-to-content link; the contact form can open with Feedback chosen.
- Account export includes support requests and notifications; deleting an account deletes
  its requests.
- Verified in headless Chrome (23 checks: help panel suggestions and search, help centre and
  feedback, checklist, reporting a problem with suggestions, staff reply and internal note,
  notification bell and read state, reopening and resolving, phone layout, no CSP
  violations); test data removed.
- Deploy: `npx cdk deploy lwk-dev-auth --exclusively` (adds the `support` group). Until then
  the Support role cannot be given; admins can already answer requests.

**Phase 10 - AI assistant**
An assistant in the help panel on every page, built so it is useful, safe and cannot overspend.

Status: DONE in code; switching it on needs the AWS account upgrade (see "Turning AI on").

- Claude on Amazon Bedrock through the Converse streaming API, called from `af-south-1` with
  global cross-Region inference profiles and the instance role (no API keys). Models and
  settings are Parameter Store values (`AI_ENABLED`, `AI_ASSISTANT_MODEL` = Claude Haiku 4.5,
  `AI_WRITER_MODEL` = Claude Sonnet 5, `AI_MONTHLY_BUDGET_USD` = 5) from `infra/lib/config.ts`.
  The instance role gets the three-part IAM policy AWS documents for global inference.
- The assistant (`src/server/ai/assistant.ts`) answers from the help centre (all articles the
  person may see are in its prompt, cached), knows the current page (course, lesson text for
  people allowed to read it, course editor checklist, and so on) and uses tools that respect
  the person's access: catalogue search, course details, my learning, my support requests,
  my courses as instructor, staff overview, and a hand-over to support. It is told to stay
  brief, link to real pages, never invent scripture quotations, never ask for passwords,
  reply in the person's language and treat page and tool text as information, not orders.
- Cost control: every call is metered (`ai_usage`, estimated from token counts at list
  prices, prompt caching included); calls stop for the month at the cap. Daily question
  limits (visitors 20 per IP, learners 50, instructors 80, staff 150) and at most 6 a minute.
  After errors that will not clear by themselves (no model access, zero quota) the app stops
  calling Bedrock for ten minutes.
- Without AI (switched off, over budget, no access) the same box answers with the best help
  articles and a route to support, so it is never a dead end.
- Privacy: conversations stay in the browser tab. The server keeps token counts only, plus
  the question and answer when someone rates an answer (`ai_feedback`) or sends the chat to
  support (it becomes a support request with the conversation included).
- Admin > AI: spend against the cap, use by feature and day, outcomes, rated answers, and a
  Check AI access button that makes a tiny real call to each model.
- Verified: 10 unit tests with a scripted Bedrock (streamed answers and sources, tool calls,
  role-scoped tools, hand-over, fallback and circuit breaker, budget cap, lesson text only for
  permitted readers) and 17 browser checks of the panel, fallback answers, metering, limits,
  hand-over, ratings and the admin page.

**Phase 11 - AI tools for each role**
Drafts and second opinions for learners, instructors and staff; people stay in charge.

Status: DONE in code (works once AI is on; until then each tool says AI is unavailable).

- Learners: **Study help** under lessons with text (text lessons, or notes and transcripts on
  video and PDF lessons, which instructors can now add): "Quiz me" makes four practice
  questions with answers and explanations (shared per lesson in `lesson_quizzes` and made
  again when the lesson changes), and "Summarise" and "Explain simply" ask the assistant.
- Instructors, in the course editor: suggest an outline from a short brief and add its
  sections and lessons to the draft; suggest a better subtitle, description and outcomes
  (each used only when chosen); and a read-through before submitting (must / should / could
  suggestions, including flagging quotations to check against a source).
- Admins: the same read-through on the course review page, and a neutral summary of an
  instructor application (strengths, open questions, questions to ask; no decision, and no
  contact details sent to the model).
- Support staff: "Draft a reply with AI" fills the reply box from the conversation and the
  relevant help articles, with a separate note for staff.
- All tools use structured output (the model must fill a JSON schema that is validated),
  the writing model (Sonnet 5) except reply drafts (Haiku 4.5), shared writing rules (accurate,
  respectful, never invent quotations or references, material is data not instructions),
  per-person daily limits, the monthly cap and metering, and are labelled as AI drafts.
- Verified: 8 tests with a scripted Bedrock (access rules, shared quizzes and regeneration,
  malformed output, unavailable and budget cases, outline apply, drafts only, review for
  instructors and admins, application summary without contact details, reply drafts) and 11
  browser checks of where each tool appears and how it degrades.

**Phase 12 - Polish: accessibility, search engines, resilience**

Status: DONE.

- Accessibility: an automated audit (axe-core, WCAG 2.1 A and AA plus best practices) of 35
  pages as a visitor, learner and admin, and the help panel, now finds no violations. Fixes:
  readable contrast (orange text on light backgrounds uses `brand-ink`, orange-700; filled
  orange buttons and badges use black text; the saffron stays for fills, borders and text on
  black), heading order (Markdown `#`/`##` become section headings), unique names for search
  areas, no ARIA attributes on links that do not allow them, and a proper list inside the chat
  log.
- Search engines: `/sitemap.xml` (public pages, published courses and free resources, help
  articles), `/robots.txt` (keeps accounts, dashboards, lessons and APIs out), canonical links,
  Open Graph and Twitter previews, and schema.org `Course` data on course pages.
- Resilience: friendly error pages (retry, home, report a problem with the page filled in) and
  a last-resort page when the whole layout fails; hourly clean-up of expired rate limits, old
  read notifications and old AI and feedback records, started by the health check.
- Performance: the first row of course images loads eagerly (largest content on the page).
- Fixed along the way: the staff request form keeps its "Saved." message while its fields
  follow changes made by replies; the remove-samples button stays, so its confirmation shows.
- The browser tests of Phases 7 to 11 (106 checks) and 119 unit and integration tests pass.

**Phase 13 - Pricing on the site**
Regional prices on the site, for display only: checkout stays "opening soon" and enrolment stays
free during early access. No payments, orders or checkout code.

Status: DONE.

- One price matrix in `apps/web/src/lib/pricing` (pure, client-safe, unit-tested) is the only
  source of prices: Membership monthly and yearly, the founding-member yearly price (members who
  join during early access and the first 1,000), Family yearly (up to 5 people in one household),
  Community seats a year (from 5 seats) and five course tiers (Short, Standard, Full course,
  In-depth, Major programme), each in four price regions. Amounts are whole minor units made by
  one checked constructor, and include VAT or GST. India and the rest of the world have yearly
  Membership only. The terms that go with the prices (Family size, minimum seats, founding
  places, the 7-day trial, the 30-day refund window for every payment, 30 days' notice before paid plans open) are
  constants beside them.
- Price regions: South Africa (ZAR), India (INR), high-income countries (the World Bank list,
  classification of 1 July 2026, reviewed each July; USD) and the rest of the world (USD). The
  country comes from CloudFront's `CloudFront-Viewer-Country` header, which the origin request
  policy `AllViewerAndCloudFrontHeaders-2022-06` forwards, and must be one of the 249 assigned ISO
  3166-1 codes (`src/lib/country-code.ts`; "UK" is not one). Every country maps to a region; a
  missing or unrecognised country gets the home region, South Africa. Pages read the region once
  (`viewerPriceRegion()` in `src/server/price-region.ts`) and pass it down.
- `PRICE_COUNTRY` (for example `PRICE_COUNTRY=IN` in `.env.local`) stands in for the header
  outside production, to see another region's prices locally; production ignores it.
- Courses have `price_tier` (1-5, enforced by a CHECK constraint). A course's pricing is one value,
  free, a tier or unpriced (`CoursePricing` in `src/lib/pricing/course-pricing.ts`), read from
  `is_free` and `price_tier` and written back in one place; free wins over a tier left behind.
  Instructors choose Free or a tier in the course editor (the options show each tier's prices).
  Only drafts may be unpriced: the review checklist asks for a price, admins cannot remove the
  price of a submitted or live course, and a course without a price cannot be published. The admin
  review page shows the tier's price in every region. Existing USD prices were mapped to the
  nearest high-income tier; paid sample courses use tier 2.
- During early access every course shows its price the same way, on cards and course pages (the
  `CoursePrice` component): a free course says Free ("This course is free for everyone" on its
  page); a priced course shows its local price struck through, then Free ("Free during early
  access"); an unpriced course says Free on cards and "Free during early access" on its page. In
  schema.org data `isAccessibleForFree` is true only for free courses, and there is an `Offer` for
  free courses (price 0, category Free) and priced ones (the local price, category Paid), none for
  unpriced ones.
- The course page names the region's Membership price. `/plans-and-pricing` shows Free,
  Membership, Family and Community for the visitor's region, the founding-member price and where
  single courses start, with an FAQ; the help centre has a "Prices and plans" article. The public
  API returns `pricing` (`{ kind: 'free' }`, `{ kind: 'tier', tier }` or `{ kind: 'unpriced' }`)
  instead of `priceUsd`: the same in every region, so responses stay cacheable.
- `price_cents` and `currency` are deprecated and no longer read or written. They stay for now
  because deploys run migrations while the previous release still serves traffic (and can roll
  back to it), and that release reads them; a later release drops them.
- Verified: unit tests of the price list, money, billing periods, country codes, regions (every
  country reaches a region, every region is reached), course pricing and the editor's price field,
  service tests of pricing in authoring, review and the catalogue, and the pages rendered for each
  region and each kind of pricing (CloudFront's country header sent to a local production build)
  at desktop and 390 px phone width, with no horizontal scrolling.

**Phase 14 - Payments** (in progress)
Paystack checkout for South Africa first; a merchant of record (Paddle, else Lemon Squeezy) for
other countries. Memberships (monthly and yearly, founding members, Family, Community seats) and
single-course purchases; access rules (members open every paid course; bought courses and courses
joined during early access stay); instructor earnings. Paid plans start when early access ends
(`EARLY_ACCESS_ENDS_AT`), announced 30 days ahead, and checkout stays behind a `PAYMENTS_ENABLED`
switch until it is ready.
Six milestones, each its own pull request: 14a records and access rules, 14b Paystack checkout for
single courses, 14c memberships, 14d billing screens and admin, 14e instructor earnings and
payouts, 14f learners outside South Africa.

Status: 14a DONE (records and access rules); 14b next.

- **Early access ends on a date, once.** The date is a reviewed constant, `EARLY_ACCESS_ENDS_AT`
  in `src/lib/early-access.ts`: null until the pull request that announces the end sets it, and
  never removed or moved once that moment has passed. Until the end every course is open to
  everyone signed in; from the end on, paid plans apply, and switching checkout off never brings
  early access back. Outside production an `EARLY_ACCESS_ENDS_AT` environment value may stand in
  for the constant, for tests and local checks (as `PRICE_COUNTRY` does for the country);
  production ignores it.
- **The copy follows the phase.** Pages read it once per request, as they read the price region,
  and pass it down: course prices (struck through and Free during early access, as they are
  afterwards, "Not on sale yet" without a price), the home banner, hero, early-access panel and
  cost answer, Plans & Pricing (banner, buttons, founding offer, FAQ), the enroll panels, My
  Learning, and the help articles about prices, enrolling and choosing a price, which the help
  centre, its search and the assistant read at the current moment (`src/server/help-viewer.ts`).
  With an end date set, the home panel, Plans & Pricing and the articles about prices and
  enrolling say when early access ends.
- **Checkout has its own switch.** `PAYMENTS_ENABLED` (Parameter Store, `false` in every stage,
  read by `src/server/payments/config.ts`) only opens or closes checkout (Phase 14b). It never
  decides who may open a course, so switching it off after launch keeps paid courses closed.
- **Dependencies point inwards.** The access rule and what it builds on (`src/server/access.ts`,
  `learning.ts`, `memberships.ts`, `early-access.ts` and everything in `src/lib`) never import from
  `src/server/payments`; a `no-restricted-imports` rule in `apps/web/eslint.config.mjs` fails lint
  if one does. Payments code may import them. access.ts is the only writer of `course_access`, and
  learning.ts has a session-free `enrollLearner` for checkout to call.
- **Records** (migration `payments_access`):
  - `course_access`: lifetime access to one course, one row per person, course and source
    (purchase, gift or admin), written only through `grantCourseAccess` (an upsert of its own
    source's row, reviving it if revoked) and `revokeCourseAccess` (its own source's row only; 14b
    also matches the refunded order). Any unrevoked row opens the course, so a gift or an admin
    grant outlives a refunded purchase. The history lives in orders and the audit log.
  - `memberships`: the payer, the plan (monthly, yearly, founding yearly, family yearly, community
    yearly), the price charged (price region, currency and amount in minor units, read and written
    through `chargedPrice` in `src/lib/pricing`, with CHECKs keeping them to the price list's
    regions and currencies), the status (trialing, active, past due, expired), the trial end (for
    reminders, required while trialing), the current period end (the end of what is paid for, or of
    the trial), cancel at period end (cancelling is not a status) and Paystack's codes (from 14c).
  - `membership_seats`: Family and Community places: the invited email, and the person and the
    acceptance time, which are set together.
  - Orders and payment events arrive with checkout in 14b, where they are first used.
- **One access rule** (`src/server/access.ts`): a pure decision, tested case by case, and a loader
  that reads the viewer's enrolment, grant and memberships (three queries, run together) only when
  the decision depends on them. It answers manage (owner or admin), open (free, early access,
  joined during early access, a grant, a membership or a seat), locked (signed out, payment
  required, unpriced) or unpublished, which callers treat as not found:

  | Course                         | During early access | After early access                                                                  |
  | ------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
  | Any, for its owner and admins  | Manage              | Manage                                                                              |
  | Not published, for anyone else | Not found           | Not found                                                                           |
  | Any, for signed-out visitors   | Free previews       | Free previews                                                                       |
  | Free                           | Everyone signed in  | Everyone signed in                                                                  |
  | Priced (a tier)                | Everyone signed in  | Joined during early access, an unrevoked grant, or a membership or seat that counts |
  | Unpriced                       | Everyone signed in  | Joined during early access; otherwise only its owner and admins                     |

  "Staff" here means a course's owner and admins: support staff are learners for course access.
  A membership counts (`src/server/memberships.ts`) while trialing or active until its current
  period ends, also when set to cancel then, and when past due until the grace days after that
  (`PAST_DUE_GRACE_DAYS`, 3, in the plan terms); an expired one never does. A seat counts when its
  membership does.

- **Early learners keep their courses.** A course the learner enrolled in before the end stays
  open to them for good, whatever its price then or later (also one that was free when joined or
  has no price), from the enrolment date alone: no grants or backfill. So `enrolled_at` is never
  rewritten, and enrolments are deleted only with the account or the course: a future "unenrol"
  must hide the place, not delete it.
- **Callers.** Enrolling, the lesson player, saving progress, My Learning and the AI lesson readers
  (practice quizzes, lesson text for the assistant) ask the rule. Learners open a course's lessons
  once enrolled in a course that is open to them, owners and admins without enrolling, so nothing
  changed during early access. What keeps lessons locked is named by condition: signed out, not
  enrolled, payment required, unpriced or access ended (enrolled, but a purchase or membership no
  longer counts). Enrolling in a closed course is refused with `access_locked` and the lock; the
  course page and the player say why, with a link to Plans & Pricing where paying can open it
  (checkout comes in 14b). Saving progress is refused once access has ended, the progress made is
  kept, and My Learning says the access has ended. The player never returns the text or media of a
  locked lesson, and the AI tools read lesson text exactly when the player would show it.
- **Admin > Courses** marks live courses without a price ("No price"): after early access only
  their owner, admins and early learners can open them, so each needs a tier or Free first. The
  data export includes course access, memberships (with the price charged) and seats.
- **At launch** (a release after 14b and 14c):
  1. Price every live course (Admin > Courses shows the ones without a price).
  2. Announce the date at least 30 days ahead (`PAID_PLANS_NOTICE_DAYS`) in a pull request that
     sets `EARLY_ACCESS_ENDS_AT` in `src/lib/early-access.ts`, for example to
     `isoDateTime('2027-03-01T00:00:00+02:00')`, and deploy it before that date. Never remove or
     move it once the end has passed.
  3. Set `PAYMENTS_ENABLED` to `true` in `infra/lib/app-stack.ts` for the stage once checkout is
     ready.
- Verified: table tests of the rule (every pricing kind, published or not, during and after early
  access and exactly at its end, signed out, owners, admins, early learners including a course
  priced after it was joined, each grant source and a revoked grant, memberships and seats), of
  when a membership counts (trial, active, past due inside, at and after the grace days, expired),
  of the phase and its setting, and of charged prices; loader tests against the database
  (grants, memberships, accepted and pending seats, a trial set to cancel, the payments switch,
  unpublished courses); tests of the grant and revoke rules and of the CHECKs; service tests of
  enrolling, the player (no locked text or media), progress, My Learning, the AI tools and the
  export; and the course price in each phase.
- Follow-ups for 14b-14d: why access ended (a refunded purchase, an ended membership or seat), for
  the player and My Learning; a lock object in place of `accessEnded` in `/api/v1/me/enrollments`;
  the membership rule as a database query for the hourly jobs, and the transitions (start a trial,
  renew, fail, cancel, expire) in 14c; `planPrice(plan, region)` in 14c; revoking by the refunded
  order in 14b.
- Follow-ups from Phase 13: a region-neutral, cacheable price-list endpoint and an uncached
  endpoint for the visitor's price region, for the mobile apps; orders and subscriptions store the
  amount, currency and region actually charged; checkout decides whether CloudFront's country
  alone is trusted for the price region.

**Turning AI on** (one time):

1. Upgrade the AWS account to the Paid plan (Billing console, "Upgrade plan"). The Free plan
   blocks AWS Marketplace models such as Claude ("not available for this account", zero
   quotas). Remaining credits carry over, and the budget alarm still applies.
2. Deploy `lwk-dev-app` (Bedrock permissions and the AI settings).
3. Enable each model once with an admin identity (AWS Marketplace subscribes the account on
   the first call), for example by using the assistant on a local development server that runs
   with the `lwk` profile, or with `aws bedrock-runtime converse` for each model ID.
4. On the site: Admin > AI > Check AI access.

**Roadmap after UAT started (Sept 2026)**

Friends are testing on the dev site. The remaining work is delivered in stages, one pull
request each:

1. Phase 7 - security, roles and accounts (above).
2. Phase 8 - Explore: free courses and free resources (videos, audio, articles, PDFs) open
   to everyone, admin tools to manage them, the full catalogue moves to `/courses`, and
   labelled sample courses for UAT (removable with one action before launch).
3. Phase 9 - Help and support: help centre, help for the current page, role-based
   onboarding checklists, support requests with replies, in-app notifications, a feedback
   button for testers, and a support role.
4. Phase 10 - AI assistant: a chat on every page that knows the page and the user's role,
   answers from the help centre and catalogue, and hands over to a person when needed.
   Usage metering, per-role daily limits and the monthly spending cap.
5. Phase 11 - AI tools per role: study help for students (explain, summarise, practise),
   writing and pre-review help for instructors, summaries and triage for admins. People
   review anything that is published.
6. Phase 12 - Polish: accessibility audit, search engines, error pages and clean-up jobs
   (above).
7. Phase 13 - Pricing on the site: regional prices for memberships and single courses, display
   only (above).
8. Phase 14 - Payments: checkout, memberships, access rules and instructor earnings.

**AI access (checked 2026-09-30):** Bedrock lists the current Claude models in
`af-south-1`, but the account cannot call them yet. The Anthropic use-case form has been
submitted (af-south-1 and us-west-2); the remaining blocker is the AWS Free plan, which
excludes AWS Marketplace offers that incur charges (Anthropic models are sold through AWS
Marketplace): calls fail with "not available for this account", and the on-demand quotas in
most regions are 0. Upgrading the account to the Paid plan (Billing console, "Upgrade plan";
remaining credits carry over) unlocks them. The Free plan ends after six months or when the
credits run out and then closes the account (AWS keeps the data for 90 days). For this account
it ends on 24 March 2027, and at the current spend (about USD 1 a day, checked 2026-10-17) the
credits last until about then, so the upgrade is needed before that date in any case. AI
features fall back to non-AI help until access works.

**Later phases (from the proposal)**

- Revenue dashboard (payments themselves are Phase 14)
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

**Domain and DNS**

- `livingwithkrishna.com` was registered at GoDaddy on 2026-10-17 (expires 2027-10-17; keep
  auto-renew and the domain lock on). GoDaddy only holds the registration: its nameservers
  point to the Route 53 hosted zone in the shared `lwk-domain` stack, where all records live
  as code.
- The dev stage is served at `dev.livingwithkrishna.com`: its certificate is in the per-stage
  `lwk-dev-edge` stack (us-east-1) and its alias records in `lwk-dev-app`. A CloudFront Function
  redirects every other host name, including the distribution's own address, to it with the
  same path and query string (301). Stages with `searchIndexing: false` send
  `X-Robots-Tag: noindex, nofollow` with every response, so dev stays out of search results.
- The main address (and `www`) is kept for production. Until launch it shows a static
  coming-soon page (`infra/coming-soon`, stack `lwk-coming-soon` in us-east-1: private S3
  bucket, its own CloudFront distribution, `www` redirects to the main address). The page is
  published from `main`: `.github/workflows/publish-main-site.yml` uploads it whenever it changes
  there (role `lwk-coming-soon-github-publish`, usable only by workflows on `main`), so the main
  address shows the page as last published from the production branch. The page has to keep to
  the stack's content security policy (checked by `infra/test`); deploy the stack first if it ever
  needs more.
- Production taking over the main address: destroy `lwk-coming-soon` first (turn off its
  termination protection), which removes the apex and `www` records and frees the CloudFront
  aliases, and delete `.github/workflows/publish-main-site.yml` and `infra/coming-soon` in the same
  change; then deploy the production stage. The main address is offline in between, and
  `bin/lwk.ts` refuses to synthesize a stage on the main address while the coming-soon stack is
  wired.
- CloudFront certificates must be in `us-east-1`; stacks there validate them against the zone
  through weak cross-stack references (`Fn::GetStackOutput`), which work across regions. AWS
  recommends that the global STS endpoint issue session tokens valid in all Regions for
  references between `us-east-1` and opt-in Regions such as `af-south-1` (IAM > Account
  settings), and `us-east-1` needs a one-time `cdk bootstrap`.
- First rollout (done 2026-10-17, after GoDaddy pointed at the zone): the account's global STS
  endpoint was set to issue session tokens valid in all Regions and `us-east-1` was bootstrapped;
  then `lwk-domain` (adds the outputs the other stacks read), `lwk-dev-edge`, `lwk-dev-auth` and
  `lwk-dev-storage` (new sign-in callback and upload origin), `lwk-dev-app`, a Deploy workflow
  run so the server picks up the new `APP_URL`, `lwk-dev-monitoring` with `ALERT_EMAIL` set, and
  `lwk-coming-soon`, whose page appears once `main` publishes it (after the promotion from `dev`
  through `uat`). After that Deploy run the CloudFront address left the dev stage's sign-in and
  upload origins (`lwk-dev-auth` and `lwk-dev-storage` deployed again); it only redirects now.
- The zone's identity is fixed once GoDaddy points at it: the stack id `lwk-domain`, its region
  and the zone's logical ID (pinned as `HostedZone`) must not change, or a second zone with new
  name servers is created. Records live in the stacks that use them, not in `lwk-domain`.
- When production moves to its own AWS account, the zone moves there (GoDaddy's nameservers
  change once) and the other stages get delegated subzones such as `dev.livingwithkrishna.com`.
- Mail: `lwk-mail` makes the domain an SES identity (DKIM, MAIL FROM `mail.livingwithkrishna.com`,
  DMARC `p=none`) and forwards support@ to the address in Parameter Store (one-time steps in the
  README); messages are kept in S3 for 30 days. A message that cannot be forwarded after Lambda's
  retries, and a forwarded copy that bounces, is marked as spam or is rejected, are reported by
  email to the same address. SES's emailed bounce notices are off for the domain, since they would
  go to support@ and be forwarded in a loop, so other mail sent from the domain later needs its own
  way to track bounces (such as a configuration set). Suppression is off for forwarded copies, so
  that one bounce or complaint does not stop all later copies, and in exchange their bounces and
  complaints count toward the account's sending reputation. Sending Cognito's email through SES
  still needs SES production access; until then Cognito sends its own emails (50 a day). When
  Cognito moves to SES, which shares that reputation, add alarms on the account's bounce and
  complaint rates (`AWS/SES` `Reputation.BounceRate` and `Reputation.ComplaintRate`) or turn
  suppression back on for forwarded copies.

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

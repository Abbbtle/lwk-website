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
6. Phase 12 - Polish: accessibility and performance audits, SEO, operations.

**AI access (checked 2026-09-30):** Bedrock lists the current Claude models in
`af-south-1`, but the account cannot call them yet. The Anthropic use-case form has been
submitted (af-south-1 and us-west-2); the remaining blocker is the AWS Free plan, which
excludes AWS Marketplace offers that incur charges (Anthropic models are sold through AWS
Marketplace): calls fail with "not available for this account", and the on-demand quotas in
most regions are 0. Upgrading the account to the Paid plan (Billing console, "Upgrade plan";
remaining credits carry over) unlocks them. The Free plan ends after six months or when the
credits run out and then closes the account, so the upgrade is needed before about December
2026 in any case. AI features fall back to non-AI help until access works.

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

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
- Prices: `apps/web/src/lib/pricing` (one price list for every region). Locally South African
  prices show; set `PRICE_COUNTRY=IN` (or another country code) in `apps/web/.env.local` to see
  another region's.
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
the site is at https://dev.livingwithkrishna.com (the CloudFront address,
https://d1uih31m6ki5c2.cloudfront.net, redirects there). Infrastructure changes are made
with CDK from `infra/` (`npm run diff` first, then `npm run deploy -- <stack>`).

Always deploy the monitoring stack with the alert address set, otherwise the email
subscription is removed: `ALERT_EMAIL=<address> npm run deploy -- lwk-dev-monitoring`.

The domain `livingwithkrishna.com` is registered at GoDaddy. Its DNS is the Route 53 zone in
the shared `lwk-domain` stack (`npm run deploy -- lwk-domain`), so the domain's nameservers at
GoDaddy must be the four values in that stack's `NameServers` output. CloudFront certificates
live in `us-east-1`: `lwk-dev-edge` for the dev site and `lwk-coming-soon`, the page on the
main address until launch. That region needs a one-time `cdk bootstrap`, and the account's
global STS endpoint should issue session tokens valid in all Regions (IAM > Account settings),
which AWS recommends for references between `us-east-1` and opt-in Regions such as `af-south-1`.

The main address shows what is on `main`: until production launches that is the coming-soon page
in `infra/coming-soon`, which `.github/workflows/publish-main-site.yml` uploads to the
`lwk-coming-soon` bucket whenever it changes on `main` (it can also be run by hand).

Open a shell on the web server (no SSH): `aws ssm start-session --target <instance-id>
--profile lwk` (requires the Session Manager plugin). App logs: CloudWatch Logs group
`/lwk/dev/web`.

### Mail for the domain

The `lwk-mail` stack (SES in `af-south-1`) receives mail for support@livingwithkrishna.com, keeps
each message in S3 for 30 days and forwards it to the address in the Parameter Store parameter
`/lwk/mail/forward-to`. Messages SES flags as a virus or spam, or that fail a sending domain's
reject DMARC policy, are not forwarded but stay in S3. When a message still cannot be forwarded
after Lambda's retries, or its forwarded copy bounces, is reported as spam or is rejected, AWS
emails a report to the same address; the message stays in S3.

Like `ALERT_EMAIL`, the address is personal and stays out of the repository. Parameters holding
such values are named `/lwk/<area>/<name>` and created by hand. Before the first deploy:

1. Create the parameter, with an address outside livingwithkrishna.com (the forwarder refuses to
   start if mail sent to that address would itself be forwarded, round in a loop):

   ```bash
   aws ssm put-parameter --name /lwk/mail/forward-to --type String --value <address> \
     --region af-south-1 --profile lwk
   ```

2. While SES is in its sandbox, verify the address in SES, then open the link AWS emails:

   ```bash
   aws sesv2 create-email-identity --email-identity <address> --region af-south-1 --profile lwk
   ```

3. Deploy from `infra/` (`npm run deploy -- lwk-mail`) and confirm the subscription in the
   "AWS Notification - Subscription Confirmation" email, so failure reports arrive.

4. Before sending a test message, wait until SES has found the domain's DKIM records (usually a
   few minutes): until then forwarding fails and only failure reports arrive.

   ```bash
   aws sesv2 get-email-identity --email-identity livingwithkrishna.com \
     --query VerificationStatus --region af-south-1 --profile lwk   # SUCCESS when ready
   ```

To change the address, verify the new one (step 2), update the parameter (step 1 with
`--overwrite`), deploy `lwk-mail` again (CloudFormation reads the parameter only when deploying)
and confirm the new subscription email.

To delete `lwk-mail`, turn off its termination protection and switch receiving off first, since
SES cannot delete the active rule set and the stack never switches it off by itself (so that
replacing its parts cannot stop mail silently):
`aws ses set-active-receipt-rule-set --region af-south-1 --profile lwk` (no rule set name).

## Checks (same as CI)

```bash
npm run format:check
npm run lint
npm run typecheck
npm test          # uses TEST_DATABASE_URL (lwk_test)
npm run build
```

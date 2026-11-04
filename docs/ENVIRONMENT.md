# Environment variables

Every variable the application reads, where it is used, and what each environment needs. **Never commit real values.** Local values live in `.env.local` (git-ignored); preview and production values live in Vercel → Settings → Environment Variables.

> `.env.example` is a committed template: names, descriptions and placeholders only. `npm run check:security` fails if any variable in it has a value (other than `false` or the local site URL). Keep real values in `.env.local` or another git-ignored `.env.*.local` file. On 2026-11-04 the owner's working copy held real hosted values; they were moved, unprinted, to the git-ignored `.env.hosted.local` and never committed (history scanned).

| Variable | Purpose | Local | Preview | Production |
|---|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Auth and public Supabase access (anon key is public by design) | from `supabase status` | project values | project values (or Vercel Supabase integration) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: invitations, private storage. Never `NEXT_PUBLIC_` | local key | project value | project value |
| `DATABASE_URL` / `POSTGRES_URL` | App connection (Supabase **transaction pooler**, port 6543). `POSTGRES_URL` (integration) takes precedence | local `127.0.0.1:54322` | pooler | pooler |
| `DIRECT_URL` / `POSTGRES_URL_NON_POOLING` | Migrations (Supabase **session pooler**, port 5432; never `db.<ref>.supabase.co`, IPv6-only) | local | not needed | required (migrations run on each production deployment) |
| `SHADOW_DATABASE_URL` | Local drift checks only (`npm run db:diff`) | local `prisma_shadow` | — | — |
| `SITE_URL` | Absolute links in emails and auth redirects | `http://localhost:3000` | preview URL | production URL |
| `ENABLE_QUOTE_SUBMISSION` | Public quote form | as needed | after P-01/C-02 | after P-01/C-02 |
| `ENABLE_TRANSACTIONAL_EMAIL` | Real email sending through Resend | `false` (or the mock, see TESTING) | after C-02 | after C-02 |
| `RESEND_API_KEY` | Resend API key (server only) | — | after C-02 | after C-02 |
| `EMAIL_FROM` | Verified sender, e.g. `Marchelo Logistics <notify@…>` | — | after C-02 | after C-02 |
| **`STAFF_NOTIFICATION_EMAIL`** | **Dedicated business inbox** (N-02), comma-separated (max 10). Read only by `staffRecipients()` in `lib/email/outbox.ts`; used only for staff-audience emails; never shown in the UI, returned by an API, put in a customer email (no reply-to/cc/bcc) or stored in the database | a test inbox you control, or unset | unset (no separate database yet) | the business inbox, set by the owner |
| **`QUOTE_LINK_SECRET`** | ≥ 32 random characters; signs the private quote links in customer emails. Without it, emails link to the portal (account holders) or the contact page. Rotating it revokes all links | any long random string | random | random, distinct from preview |
| **`RESEND_WEBHOOK_SECRET`** | `whsec_…` signing secret of the Resend webhook (delivered/bounced/complained) | — | optional | after C-02 |
| `RESEND_BASE_URL` | Testing only: points the Resend SDK at a local mock (`npm run test:journeys`) | test only | **never** | **never** |
| `CRON_SECRET` | ≥ 32 characters; Vercel Cron bearer token for `/api/cron/*` | for manual runs | random | random |
| `RATE_LIMIT_SALT` | Salt for hashed rate-limit keys | any | random | random |
| `EMAIL_DEV_LOG` | Development only: log instead of sending | optional | ignored in production builds | ignored |
| `RETENTION_EXECUTION_ENABLED` | Allows retention deletions (also needs an approved policy, L-03) | `false` | `false` | `false` until L-03 |
| `ENABLE_CUSTOMER_REGISTRATION` | Open registration (C-03 answered). Also needs Supabase sign-ups + email confirmation on and custom SMTP | `true` to test | `false` until a separate preview database exists | `true` only after the switch-on checklist (DEPLOYMENT.md) |
| `ENABLE_DOCUMENT_UPLOADS` | Off until L-03 | `false` | `false` | `false` |
| `ENABLE_DEMO_DATA`, `ENABLE_PREVIEW_AREAS` | Development only (forced off in production) | optional | `false` | `false` |
| `RELEASE_BUILD` | `true` only for the approved launch build (R-03); fails while owner markers remain | `false` | `false` | `false` until launch |
| `SEED_USER_PASSWORD` | Local demo users only | optional | **not set** | **not set** |

## Owner configuration (code, not secrets)
`config/owner.ts`:
- `operations.routes`: offered routes and monthly departure windows (S-02).
- `pricing.taxRatesBp`: approved tax rates in basis points; **empty** until P-03 (tax lines unavailable).
- `notifications.quoteExpiryReminderHours`: hours before expiry for a reminder email; **null** (off) until approved.

## Per Vercel environment (2026-11-04)
### Verified state (2026-11-04, read-only: `vercel env ls` and the Vercel API)
Values were never printed. Flags were read individually; secrets were compared in memory only where Vercel allows reading them.

| Variable | Production | Preview |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` | set (Production only) | **not set** |
| `SITE_URL` | set: `https://marcelo-logistics.vercel.app` (**not yet the official domain**, see DEPLOYMENT.md) | not set |
| `CRON_SECRET`, `RATE_LIMIT_SALT` | set, ≥ 32 characters (verified) | set, own variable, type *Sensitive* |
| `QUOTE_LINK_SECRET` | set, type *Sensitive* | set, own variable, type *Sensitive* |
| `ENABLE_*` (6), `EMAIL_DEV_LOG`, `RETENTION_EXECUTION_ENABLED`, `RELEASE_BUILD` | all `false` (verified) | all `false` (verified) |
| `STAFF_NOTIFICATION_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | not set | not set |
| `SHADOW_DATABASE_URL`, `SEED_USER_PASSWORD` | removed | removed |

Project settings (verified): production branch `master`; Ignored Build Step builds **production only** (`if [ "$VERCEL_ENV" == "production" ]; then exit 1; else exit 0; fi`), so pushes to other branches create no deployment; Deployment Protection on all deployments except custom domains; no Preview deployments exist (the 7 older ones, built while Preview shared Production's variables, were deleted). Domains `marchelo-logistics.com` and `www.marchelo-logistics.com` are attached to Production and resolve to Vercel.

**Not verified:** whether the *Sensitive* values (all three Preview secrets and Production `QUOTE_LINK_SECRET`) are ≥ 32 characters and different from Production: Vercel never returns Sensitive values. Replacing the Preview values with freshly generated ones would make this certain; that needs the owner's approval.

### Required configuration
| Variable | Production | Preview | Development (Vercel) |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | production project | **unset** until a separate preview project exists, then that project's values | unset (local uses `.env.local`) |
| `DATABASE_URL` (or integration `POSTGRES_URL`) | transaction pooler, 6543 | **unset** (same rule) | unset |
| `DIRECT_URL` (or `POSTGRES_URL_NON_POOLING`) | session pooler, 5432 (migrations on deploy) | **unset**: previews never migrate | unset |
| `SITE_URL` | production URL | preview URL, or unset | unset |
| `CRON_SECRET`, `RATE_LIMIT_SALT`, `QUOTE_LINK_SECRET` | random, ≥ 32 chars | **different** random values | unset |
| `STAFF_NOTIFICATION_EMAIL` | the dedicated business inbox | unset | unset |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | after C-02 | unset | unset |
| `ENABLE_TRANSACTIONAL_EMAIL` | `true` after C-02 | `false` | — |
| `ENABLE_QUOTE_SUBMISSION`, `ENABLE_CUSTOMER_REGISTRATION` | per the go-live checklist | `false` | — |
| `ENABLE_DOCUMENT_UPLOADS`, `RETENTION_EXECUTION_ENABLED` | `false` (L-03) | `false` | — |
| `ENABLE_DEMO_DATA`, `ENABLE_PREVIEW_AREAS`, `EMAIL_DEV_LOG` | `false` (forced off in production builds anyway) | `false` | — |
| `RELEASE_BUILD` | `true` only for the approved launch (R-03) | `false` | — |
| `SHADOW_DATABASE_URL`, `SEED_USER_PASSWORD`, `ALLOW_MIGRATE_HOST`, `RESEND_BASE_URL` | **never** | **never** | **never** |

With the database variables unset, a preview would run in the same "not available" mode as before Supabase was connected (public pages only; no accounts, quotes or tracking). Today no preview is built at all (Ignored Build Step). Before allowing previews again, create a separate Supabase project for them and give Preview its own values.

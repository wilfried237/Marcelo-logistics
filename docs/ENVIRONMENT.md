# Environment variables

Every variable the application reads, where it is used, and what each environment needs. **Never commit real values.** Local values live in `.env.local` (git-ignored); preview and production values live in Vercel → Settings → Environment Variables.

> `.env.example` currently contains uncommitted local edits made by the owner (real values). It was deliberately not modified in this phase so those values cannot be committed by accident. Add the new variables below to it once it has been restored to placeholders (`git checkout -- .env.example`).

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
| **`STAFF_NOTIFICATION_EMAIL`** | Internal alert inbox(es), comma-separated (max 10). Never shown in the UI, returned by an API or stored in the database | your own address if you want local alerts | owner's choice (P-01) | owner's choice (P-01) |
| **`QUOTE_LINK_SECRET`** | ≥ 32 random characters; signs the private quote links in customer emails. Without it, emails link to the portal (account holders) or the contact page. Rotating it revokes all links | any long random string | random | random, distinct from preview |
| **`RESEND_WEBHOOK_SECRET`** | `whsec_…` signing secret of the Resend webhook (delivered/bounced/complained) | — | optional | after C-02 |
| `RESEND_BASE_URL` | Testing only: points the Resend SDK at a local mock (`npm run test:journeys`) | test only | **never** | **never** |
| `CRON_SECRET` | ≥ 32 characters; Vercel Cron bearer token for `/api/cron/*` | for manual runs | random | random |
| `RATE_LIMIT_SALT` | Salt for hashed rate-limit keys | any | random | random |
| `EMAIL_DEV_LOG` | Development only: log instead of sending | optional | ignored in production builds | ignored |
| `RETENTION_EXECUTION_ENABLED` | Allows retention deletions (also needs an approved policy, L-03) | `false` | `false` | `false` until L-03 |
| `ENABLE_CUSTOMER_REGISTRATION`, `ENABLE_DOCUMENT_UPLOADS` | Off until C-03 / L-03 | `false` | `false` | `false` |
| `ENABLE_DEMO_DATA`, `ENABLE_PREVIEW_AREAS` | Development only (forced off in production) | optional | `false` | `false` |
| `RELEASE_BUILD` | `true` only for the approved launch build (R-03); fails while owner markers remain | `false` | `false` | `false` until launch |
| `SEED_USER_PASSWORD` | Local demo users only | optional | **not set** | **not set** |

## Owner configuration (code, not secrets)
`config/owner.ts`:
- `operations.routes`: offered routes and monthly departure windows (S-02).
- `pricing.taxRatesBp`: approved tax rates in basis points; **empty** until P-03 (tax lines unavailable).
- `notifications.quoteExpiryReminderHours`: hours before expiry for a reminder email; **null** (off) until approved.

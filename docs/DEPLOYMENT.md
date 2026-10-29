# Deployment

> **Nothing has been deployed.** No DNS, domain or production change has been made. The WordPress site on `marchelo-logistics.com` remains untouched.

## Target
- **Vercel**, preview deployments only during implementation; functions pinned to an EU region (`dub1` Dublin or `fra1` Frankfurt), matching the Supabase region.
- **Supabase** project in an approved EU region (owner decision R-01).
- **Resend** with a verified sending domain (owner decision C-02).

## Preview deployment checklist
1. Owner creates or approves the Vercel and Supabase accounts (R-01).
2. Apply migrations **only after approval** (R-02; procedure in DATABASE.md).
3. Vercel → Project → Settings:
   - Environment variables for **Preview** only (names in `.env.example`). Never add the service-role key or database URLs with a `NEXT_PUBLIC_` prefix.
   - Function region: an EU region.
   - **Deployment Protection: on** (Vercel Authentication or password), so unfinished previews are not public.
4. Supabase Auth → URL configuration: add the preview URL to the redirect allow-list (`https://<preview-host>/api/auth/callback`).
5. Keep `ENABLE_*` flags off on the preview until each prerequisite is met:

| Flag | Enable only when |
|---|---|
| `ENABLE_QUOTE_SUBMISSION` | Database migrated, staff reviewer assigned (P-01), email working (C-02) |
| `ENABLE_TRANSACTIONAL_EMAIL` | Resend domain verified, `EMAIL_FROM` and `STAFF_NOTIFICATION_EMAIL` set |
| `ENABLE_CUSTOMER_REGISTRATION` | Owner chooses open registration (C-03) |
| `ENABLE_DOCUMENT_UPLOADS` | Retention policy approved (L-03) |
| `ENABLE_DEMO_DATA`, `ENABLE_PREVIEW_AREAS` | Never on production (forced off by code) |

## Production (requires explicit approval: R-03)
- A Vercel production build sets `VERCEL_ENV=production`, which makes the build **fail** while any `{{NEEDS_OWNER}}` marker remains. This is intentional.
- The domain cut-over from WordPress needs a migration plan: URLs and redirects, email records on the domain, and DNS ownership. This is out of scope until approved.

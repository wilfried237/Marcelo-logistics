# Runbook: creating the first administrator

Status: **prepared, not executed.** Production has no users. Run this only after the owner approves it in writing.

## Why a special procedure

Every role change in the application goes through `setUserRole` (in `lib/services/users.ts`), then `assertAdmin`, then the database function `public.admin_set_user_role`. That path requires an existing administrator, so the first one cannot be created from the dashboard.

[`scripts/provision-admin.mjs`](../../scripts/provision-admin.mjs) is the only supported way to create the first administrator.

| Property | How it is enforced |
| --- | --- |
| No public route | It is an operator command-line tool. No page, API or server action calls it. |
| Never in the deployed app | It exits immediately when `VERCEL` or `VERCEL_ENV` is set. |
| No hardcoded credentials | Secrets come from the operator's shell. The tool never prints secrets or URLs, and it masks the email address in its output. |
| No password handled by anyone else | A new address receives a Supabase invitation, and the owner chooses the password. An existing account is promoted without any email. |
| Hosted projects need explicit approval | It refuses any non-local host unless `ALLOW_PROVISION_HOSTS` lists **both** the Supabase API host and the database host exactly. The API, the database and `--project-ref` must name the same project; secrets must come from the shell; mixed local and hosted targets are refused. |
| One time only | It refuses if any administrator exists, checked again under the advisory lock that `admin_set_user_role` uses. |
| No self-elevation | It uses the trusted path (`app.role_change`). The profile trigger rejects role changes made any other way (covered by a test). |
| Audited | The `profiles_audit` trigger records the role change in `audit_log`. |
| Dry run by default | Nothing changes without `--apply`. |

Tests: `tests/supabase/provision-admin.test.ts` runs against the real local Supabase stack and covers:

- the guards;
- a dry run that changes nothing;
- inviting a new address and promoting it;
- the second-run refusal;
- promoting an existing account without sending email;
- a blocked self-elevation.

## Before you start (owner decisions)

1. **The administrator's email address.** The owner has confirmed it privately. It is **not** written in this public repository. Use it only on the command line.
2. **Invitation email.** Supabase sends the invitation through its own email service unless custom SMTP is configured (see `docs/DEPLOYMENT.md`, "Transactional email activation"). The built-in service is rate-limited and sends from a Supabase address. Either approach works for one invitation. Check the spam folder.
3. **Locale** of the invitation landing page: `en` or `fr`.
4. **Production checks.** Do these in the Supabase dashboard, read-only:
   - Authentication → URL configuration: Site URL is `https://marchelo-logistics.com`.
   - The redirect allow-list contains `https://marchelo-logistics.com/api/auth/callback**`.
   - The invite template links to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`, as committed in `supabase/templates/invite.html`. The committed template file is the source of truth. If the hosted template differs, the link opens the home page instead of the password page.

## Procedure (production, after approval)

Run it from a trusted machine in a fresh terminal. Do not use a CI job.

### Exactly three production credentials

| Variable | Where to find it | Secret? |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API: `https://<ref>.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys: the `service_role` (legacy) or `sb_secret_…` key | **Yes** |
| `DIRECT_URL` | Supabase → Connect → **Session pooler** (port 5432): `postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres` | **Yes** (it contains the database password) |

You also need the project ID (`<ref>`, Supabase → Project Settings → General) and `SITE_URL`. No Vercel or Resend credential is needed.

### Checks the tool makes before changing anything

1. **Refuses on Vercel.**
2. **Refuses mixed targets.** A hosted API with a local database, or the reverse, is refused.
3. **Hosted secrets must come from the shell.** For a hosted project, the three variables must be set in **this shell**. A value picked up from `.env.local` or `.env` is refused, so a forgotten variable cannot fall back to the local database.
4. **Both hosts must be allowed.** The API host and the database host must both appear in `ALLOW_PROVISION_HOSTS`.
5. **One project, named by the operator.**
   - The project ID in the API host must equal the one in the database. That comes from the pooler user `postgres.<ref>` or from a host `db.<ref>.supabase.co`.
   - It must also equal `--project-ref`, typed by the operator.
   - A legacy JWT key must be a `service_role` key for that project.
6. **Read-only key check.** A `listUsers` call (one row) must succeed with the key against that project's Auth API.
7. **Read-only database checks.** It counts the existing admins (and refuses if there are any), then looks the address up in `auth.users`.
8. **Dry run unless `--apply`.** Without the flag, nothing is written and no email is sent.

### Commands (Git Bash, from the repository root, on the merged `master`)

```bash
# 0. Fresh terminal; turn off history for this session, so nothing is saved.
set +o history
cd /c/TRAVAIL/Next.js/test/marcel-logistics
git checkout master && git pull --ff-only

# 1. Credentials for this shell only. Pasted values are not shown on screen.
export SUPABASE_URL="https://<ref>.supabase.co"
read -rs -p "Service role key: " SUPABASE_SERVICE_ROLE_KEY; echo; export SUPABASE_SERVICE_ROLE_KEY
read -rs -p "Session pooler URL: " DIRECT_URL; echo; export DIRECT_URL
export SITE_URL="https://marchelo-logistics.com"
export ALLOW_PROVISION_HOSTS="<ref>.supabase.co,<region>.pooler.supabase.com"

# 2. Dry run: prints "HOSTED project <ref>", the two hosts, the masked address and the plan. Changes nothing.
node scripts/provision-admin.mjs --email "<OWNER_ADMIN_EMAIL>" --locale fr --project-ref <ref>

# 3. Apply, only if the dry run printed the right project and "plan: send a Supabase invitation":
node scripts/provision-admin.mjs --email "<OWNER_ADMIN_EMAIL>" --locale fr --project-ref <ref> --apply

# 4. Clear everything:
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DIRECT_URL SITE_URL ALLOW_PROVISION_HOSTS
set -o history
```

Expected output of step 3: `done. Invitation sent; the account has the admin role.`

**What happens in step 3:**

- Supabase Auth (`auth.admin.inviteUserByEmail`) creates the user and sends the invitation email.
- The database trigger `app_on_auth_user_created` gives the new user a `customer` profile, as for every new user.
- In one transaction, under the role-change advisory lock, the tool checks again that there is no administrator. It then sets `profiles.role = 'admin'` through the trusted path (`app.role_change`).
- The `profiles_audit` trigger records the change.
- If anything fails, the transaction rolls back and no role changes.

The script prints only the masked address, the host names and the project ID. It never prints keys, the database URL or passwords. Error messages from `pg` and supabase-js do not include credentials.

## After the run

1. The owner opens the invitation email, follows the link to `/<locale>/reset-password` and chooses a password of at least 12 characters.
2. The owner signs in at `https://marchelo-logistics.com/<locale>/login` and lands on `/<locale>/admin`.
3. Verification:
   - read-only SQL in the Supabase editor: `select role, count(*) from public.profiles group by role;` should show `admin | 1`;
   - `/en/admin/users` lists the account as Administrator;
   - `/en/admin/audit` shows the role change.
4. Further staff and administrators: Staff area → Users → Invite. Choose the role there; it calls `inviteUserAction`, which is admin-only. The database prevents removing the last administrator.

## If something goes wrong

| Symptom | Action |
| --- | --- |
| `refused: an administrator already exists` | Nothing changed. Sign in with the existing administrator, or check `profiles` with a read-only query. |
| `invitation failed: ...` | No role was changed. Check the Supabase Auth logs and the SMTP or rate limit, then re-run. The tool then finds the existing account and promotes it without another email. |
| The invitation link opens the home page | The redirect allow-list or the invite template does not match (see "Before you start", point 4). The account is already an administrator, so the owner can use **Forgot password** on `/<locale>/forgot-password` once the allow-list is fixed. |
| The wrong address was promoted | An administrator demotes it from Staff area → Users. Before any administrator exists, run the documented SQL path in `docs/DATABASE.md` to set it back to `customer`. |

## Admin capabilities available after sign-in (verified in code and in the full-stack journeys)

| Area | Route | What an administrator can do |
| --- | --- | --- |
| Dashboard | `/admin` | Counts and the latest work items |
| Quote requests and quotations | `/admin/quotes`, `/admin/quotes/[reference]` | Review requests, request information, build itemised quotations (staff-entered prices, EUR or XAF), send, expire or cancel; customer acceptance and rejection are recorded |
| Shipments and tracking | `/admin/shipments`, `/admin/shipments/[reference]` | Create a shipment from an accepted quote, add milestones (customer-visible or internal), manage the delivery estimate and its visibility |
| Customers | `/admin/customers` | Customer records and their requests and shipments |
| Enquiries | `/admin/enquiries` | Contact-form enquiries and their status |
| Notifications | `/admin/notifications` | Email outbox status: sent, failed, bounced, complained, dead |
| Staff and permissions | `/admin/users` (administrators only) | Invite users, change roles (customer, staff, admin), with last-administrator protection |
| Audit | `/admin/audit` (staff and administrators) | Append-only change history |

Staff (non-admin) accounts see everything except Users: that page returns 404 for them, and the role and invite actions call `assertAdmin`. The server enforces this in `requireRole` and `pageStaff`, and again in the database row-level security policies.

# Stage 4: customer accounts and portal

_2026-11-10, branch `feat/stage-4-customer-accounts`, built on the corrected Stage 3 branch (`95e150e`); kept separate from Stage 7. Not merged, pushed or deployed. No production setting, record or email was touched. Public registration stays closed._

## Audit: what already existed (reused, not rebuilt)

| Area | Implementation | Verified by |
|---|---|---|
| Invitation-only accounts | Supabase sign-up disabled; `ENABLE_CUSTOMER_REGISTRATION=false`; `/register` explains that accounts are by invitation; new users always start as `customer` (database trigger), whatever the metadata says | `tests/supabase/auth-and-rls.test.ts`, journey G |
| Email verification and links | `/api/auth/callback` handles PKCE codes and token hashes for sign-up, recovery, invitation and email links, then redirects only to validated same-site paths (`safeNextPath`) | unit tests, Supabase tests |
| Login and logout | Server actions; non-enumerating errors; per-client and per-email rate limits that fail closed, on top of Supabase's own | Supabase tests, journeys |
| Recovery and reset | Same "check your email" answer whether or not the address exists; 12-character minimum; single-use tokens | Supabase tests |
| Sessions | HttpOnly, SameSite=Lax, Secure on HTTPS; refreshed in `proxy.ts`; every request validates the token with Supabase (`getUser`); the role is read from the database, never from the token | unit tests (`security-headers`, cookie options) |
| Profile | Name, phone and language editable; sign-in email changed only through the business (stated on the page) | integration tests |
| Own quotations and shipments | Portal lists and details, accept or decline, replies; RLS **and** explicit ownership filters; foreign references return 404 | integration, RLS and journey tests |
| Role protection | `admin_set_user_role` only (advisory lock, last-admin guard, audited); `profiles.role` not writable by clients | Supabase tests |

## Implemented in Stage 4

| Change | Why |
|---|---|
| **Clear link states:** the callback tells an *expired or already used* link (`link_expired`) apart from an *invalid* one (`link_invalid`), from Supabase's `error_code` and from code-exchange errors. The login page shows the matching message with a "Forgot your password?" link. Only these two codes are ever read from the URL | Invitation and recovery links expire; "invalid" was confusing for a link that simply timed out. Reveals nothing about whether an account exists |
| **Unconfirmed email:** a specific message when Supabase reports `email_not_confirmed` | GoTrue checks the password first, so only someone with the correct password ever sees it |
| **Password change errors:** `same_password` and `reauthentication_needed` now have their own messages (previously "We could not complete this request") | The local stack has `secure_password_change = true`; an older session must re-authenticate |
| **Profile, "Sign-in and security":** a "Change your password" link (reuses the existing reset page and action) and **"Sign out on all devices"** (`signOut({ scope: "global" })`), which returns to the login page with a confirmation | Account self-service; ends sessions left open on other devices |
| EN and FR text for all of the above (1,264 keys each) | Parity |

No database migration, no new endpoint, no new dependency, no change to Supabase or SMTP settings.

## Tests added

| Suite | New tests |
|---|---|
| Unit | Link-error mapping and the login-URL error allow-list (`tests/unit/auth-redirects.test.ts`) |
| Local Supabase | A customer cannot update another customer's profile, change or delete another customer's request, post a message on it, or take over a customer record; the database confirms nothing changed. Global sign-out revokes the other session's refresh token |
| Full stack: access matrix (`tests/e2e-fullstack/access-control.spec.ts`) | **Direct HTTP requests** for anonymous, customer one, customer two, staff and admin: portal pages, another customer's request (404), staff pages (404 for customers), user management (admin only), document downloads (401 or 404), cron jobs (401 even for admins: a session is not the cron secret), unsigned webhook, legacy API; hostile `next` targets after a real sign-in; forged callback parameters |
| Full stack: account journey (`tests/e2e-fullstack/account.spec.ts`) | A fresh local customer signs in; EN and FR profile; generic wrong-password message; expired and invalid link messages; password change (same password refused, then changed; old one refused); **sign out on all devices ends the other browser's session**; ordinary sign-out ends only this one; phone layout and axe checks on the account pages |

**Test infrastructure:** every local request shares one client identifier, so the many sign-ins in these suites tripped the application's (intended) per-client login limit for the suites that ran after them. `tests/e2e-fullstack/local-db.ts` clears the local login counters between suites. It is local-only and refuses any non-local database. The limiter itself is unchanged.

## Security findings

| # | Severity | Finding | Proposed action |
|---|---|---|---|
| S4-1 | Low | Staff and admins can open `/portal`. They see their own (empty) customer record only, never anyone else's | Optionally redirect staff to `/admin` |
| S4-2 | Low | Revoked sessions are refused at once by the local GoTrue (the browser test proves it). The hosted project's behaviour must be confirmed in the approved production customer test | Include it in the production test |
| S4-3 | Info | No self-service email change or account deletion. Both go through the business (email change is stated on the profile page) | Owner decision A-03 (below) |
| S4-4 | Info | French confirmation messages use the masculine form ("connecté", "déconnecté"), like the rest of the site | Owner or translator review |

No cross-customer read or write path was found; every direct attempt was refused, by the server and by the database.

## Production compatibility review (nothing changed in production)

- **Code only:** no migration (production should report "No pending migrations"), no environment variable, no flag.
- **Supabase Auth (hosted):** uses only existing APIs (`signOut` with `global` scope, `updateUser`, `verifyOtp`, `exchangeCodeForSession`). The redirect URL allow-list and email templates are unchanged.
- **To confirm read-only before release (approval to view the dashboard):**
  - whether **Secure password change** is enabled in production (if it is, older sessions see the new re-authentication message);
  - the email-link (OTP) expiry;
  - refresh-token rotation.
- **Emails:** recovery and invitation emails still go through Supabase Auth's Resend SMTP. Nothing new is sent.
- **Rollback:** Instant Rollback; no data or schema to undo.

## Decisions still required

- **C-03 (launch):** when to open public registration. It stays closed.
- **A-03 (new):** account self-service: email change, account deletion and data export. Today these go through the business by email.
- **L-02 and L-03:** privacy notice and retention, before accounts are offered widely.

## Actions requiring approval

1. Viewing the production Supabase Auth settings listed above (read-only).
2. The production invited-customer test: one owner-controlled address, invitation, set password, sign-in, profile, change password, sign out on all devices; then remove the test account. This sends real invitation and recovery emails.
3. Merging and deploying Stage 4, after Stage 3.

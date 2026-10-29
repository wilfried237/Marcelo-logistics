# Implementation Status

_Last updated: 2026-10-30_

## Branches
| Branch | Base | Content | Pushed? |
|---|---|---|---|
| `phase-0-stabilisation` | `master` | Phase 0 (stable checkpoint, `6d97295`) | No (local only) |
| `feat/mvp-database-and-app` | `phase-0-stabilisation` | Database, data layer, auth, email, pages, portal, staff area, tests, docs | No (local only) |

The intended integration is a pull request from each branch to `master`, Phase 0 first. Nothing has been merged, force-pushed or deployed. The GitHub CLI is not installed here, so no pull request was opened.

## Stages
| Stage | Status | Evidence |
|---|---|---|
| A. Repository review and protection | ✅ Complete | Pre-existing `(auth)` work committed unchanged (`f3b6d75`); branch created; decisions consolidated |
| B. Phase 0 stabilisation | ✅ Complete | See Phase 0 acceptance below |
| C. Database architecture | ✅ Complete (not applied to any Supabase project) | `drizzle/`, 49 database tests on PostgreSQL (PGlite) |
| D. Application data layer | ✅ Complete | `lib/services`, 20 integration tests |
| E. Public website pages | ✅ Complete | E2E desktop + mobile, axe |
| F. Authentication and protected pages | ✅ Implemented; **real Supabase flows not yet exercised** | Needs a Supabase project (TESTING.md) |
| G. Quote operations and tracking | ✅ Implemented and tested at service level; public submission **disabled** until prerequisites are met | DEPLOYMENT.md flag table |
| H. Email and documents | ✅ Implemented with mocked provider and in-memory storage tests; real sending and storage **disabled** | C-02, L-03 |
| I. Final hardening and verification | ✅ Done for this session | Results below |

### Phase 0 acceptance
| Criterion | Status |
|---|---|
| Dependency patch applied (Next 15.5.28, React 19.1.10, next-intl 4.14.9, Zod 4.6.7) | ✅ |
| TLS verification enabled for installs | ✅ for every npm command run here (`NODE_TLS_REJECT_UNAUTHORIZED` unset); the machine-level source still needs removing by the owner |
| API routes bypass locale middleware | ✅ verified on a production build |
| No endpoint returns unauthorised personal data | ✅ legacy GET removed; RLS-protected data layer |
| Unauthorised shipment updates rejected | ✅ legacy POST removed (405); staff-only actions + RLS |
| Feature flags default off | ✅ tested |
| Mock customer data not public | ✅ mock portal removed |
| Fabricated claims hidden | ✅ static check + E2E |
| Honest forms | ✅ |
| Security headers | ✅ |
| TypeScript, lint, build, tests pass | ✅ |
| Audit recorded | ✅ SECURITY.md |

## Commits (oldest first)
```
f3b6d75 chore(auth): move login page into (auth) route group (pre-existing work)
5547fff docs: add audit, roadmap, decision register and phase plans
a69ba36 fix(deps): patch Next.js and runtime dependencies for security advisories
4ab3d55 chore: add test tooling, feature flags and quality-gate scripts
917c801 fix(api): lock down quote and tracking endpoints before routing is fixed
9d5cff9 fix(middleware): stop locale middleware from redirecting /api routes
959179d fix(routes): gate mock portal and dashboard behind preview flag
2b08db3 fix(content): remove fabricated claims and template leftovers; honest forms
89d988f feat(security): add security headers and remove X-Powered-By
6d97295 docs: consolidate owner decisions into DECISIONS-REQUIRED.md      <- end of Phase 0
15298c2 feat(db): database foundation with RLS, lifecycle triggers and audit log
6e20ecc feat(data): application data layer for quotes, shipments, tracking and roles
3afc633 feat(ui): design system, route-group shells and bilingual message catalogue
beb7798 feat(auth): Supabase Auth with server-side sessions and role helpers
7557704 feat(email): bilingual transactional email via Resend and React Email
33e1dad feat(site): public pages, step-by-step quote request and public tracking
ac64c4e feat(portal): customer portal and private documents
459cbe3 feat(admin): role-protected staff and admin area
8e3923c chore: remove unused UI scaffolds and dependencies
4a96200 test(e2e): Playwright + axe end-to-end tests on desktop and mobile
(+ the documentation commit that adds this file)
```

## Tests executed (2026-10-30)
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm run lint` | ✅ 0 problems |
| `npm run check:i18n` | ✅ EN/FR 472 keys each |
| `npm run check:security` | ✅ pass |
| `npm run check:owner` | ⚠️ 10 unresolved owner markers (expected; release builds fail by design) |
| `npm test` (Vitest) | ✅ 16 files, 150 tests |
| `npm run build` | ✅ pass |
| `npm run test:e2e` | ✅ desktop 28 passed; mobile 28 passed, 1 skipped |
| `npm audit --omit=dev` | ✅ 0 critical/high/moderate; 4 low (accepted, SECURITY.md) |

Not executed (services unavailable): RLS on a real Supabase stack, real Supabase Auth flows, real Storage, real email delivery. Procedures are in TESTING.md.

## Security findings
See [SECURITY.md](./SECURITY.md). Open items: nonce-based CSP (G-1), verification on a real Supabase stack (G-2, G-3), preview protection (G-5), scheduled quote expiry (G-7), retention workflows (G-8), the TLS override on this machine (G-9).

## Outstanding technical blockers
None for local development. Activating features needs external configuration (below).

## Outstanding owner decisions
See [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). These block a **public release**: B-01 name, B-02 legal entity, S-01 services, C-01 contact details, L-01 terms, L-02 privacy controller, A-01 logo, R-03 launch. These block **enabling features**: P-01 reviewer, C-02 email domain, L-03 retention, R-01 accounts/region, R-02 migration approval.

## Required external configuration
1. Supabase project in an EU region (R-01), then the approved migration (R-02) and the first admin bootstrap (DATABASE.md).
2. Vercel project with EU functions, preview-only env vars and Deployment Protection.
3. Resend account with a verified sending domain (DNS on the owner's domain; C-02).
4. `pg_cron` schedule for `app_expire_quotes()`.

## Next concrete tasks
1. Owner: answer the ★ decisions in DECISIONS-REQUIRED.md; approve accounts and region (R-01).
2. Run the database and auth test procedures against `supabase start` (TESTING.md), then request R-02 approval with the reviewed SQL.
3. Create a protected Vercel preview; enable quote submission once email and a reviewer are in place.
4. Replace `{{NEEDS_OWNER}}` values as answers arrive (`npm run check:owner` lists them).
5. Security follow-ups G-1 (nonce CSP) and G-7 (expiry schedule).
6. FR copy review by a fluent speaker.

# Logistics platform (Ireland ⇄ Cameroon)

Bilingual (EN/FR) website and MVP platform for a logistics and freight-forwarding business: public site, staff-reviewed quote requests, public shipment tracking, customer portal and staff area.

The business name is pending owner confirmation (see `docs/DECISIONS-REQUIRED.md`, B-01).

## Quick start
```bash
npm ci
cp .env.example .env.local
npm run dev            # http://localhost:3000/en
```
Without Supabase and database settings, the site runs with honest "not available yet" states. For the full stack see [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md).

## Scripts
| Script | Purpose |
|---|---|
| `dev`, `build`, `start` | Next.js (build runs the owner-placeholder and i18n gates first) |
| `typecheck`, `lint` | Static checks |
| `test`, `test:db`, `test:e2e` | Vitest (unit, PostgreSQL via PGlite, integration) and Playwright |
| `test:supabase` | Vitest against a running **local** Supabase stack (refuses non-local hosts) |
| `check` | typecheck + lint + i18n + security + tests |
| `check:i18n`, `check:owner`, `check:security` | Quality gates |
| `db:generate`, `db:validate`, `db:diff`, `db:status` | Prisma Client generation, schema validation, drift check, migration status |
| `db:migrate`, `db:seed` | Prisma migrations (`migrate deploy`, local hosts only unless approved) and local-only seed |

## Documentation
- [Implementation status](docs/IMPLEMENTATION-STATUS.md): what is done, tested and pending
- [Decisions required](docs/DECISIONS-REQUIRED.md): open owner decisions (answer here)
- [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md)
- Earlier audit and planning documents: `docs/UI-UX-AUDIT.md`, `docs/IMPLEMENTATION-ROADMAP.md`, `docs/PHASE-0-PLAN.md`, `docs/PHASE-1-REDESIGN-SPEC.md`

## Rules for contributors
- Never invent business facts, prices, delivery times, reviews or legal text. Use `{{NEEDS_OWNER}}` in `config/owner.ts` or `messages/*.json`.
- Every user-facing string goes in both `messages/en.json` and `messages/fr.json`.
- Feature flags default to off. A flag never replaces authorisation.
- Never use `prisma db push` or `prisma migrate dev` against a shared database; never apply migrations to shared databases without approval.
- Prisma Client and the service-role key are server-only (enforced by `npm run check:security`).

# BTTR Fit

A habit tracker for body recomposition. Six daily metrics, three sentinel lifts logged
weekly, run in eight week blocks. The product exists to answer one question with
evidence: is bodyweight falling while strength holds?

Mobile-first responsive web app, built as the direct precursor to a native port.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 with a custom token layer
- Supabase: Postgres, Auth (magic link and email/password), row level security
- Vitest for the domain layer
- Vercel for deployment

## Architecture: the domain layer boundary

All business logic — compliance percentages, rolling weight averages, lift
normalisation, the recomp verdict, streaks — lives in `lib/domain` as pure
TypeScript functions with unit tests.

`lib/domain` imports nothing from React, Next, Supabase, or any other part of the
repo. That is enforced by an ESLint rule in `eslint.config.mjs`, not by convention.

The reason is a planned React Native port by the same solo developer: the domain
layer lifts across wholesale, and the only work left is the UI. It also means the
part of the product that is expensive to get wrong is testable without a browser,
a database, or a render.

```
app/                    Next.js routes
components/             Presentational components
lib/domain/             Pure TS business logic (no React, no Supabase)
lib/domain/*.test.ts    Vitest unit tests
lib/data/               Supabase clients, queries and mutations
lib/design/             Token definitions
supabase/migrations/    SQL migrations
scripts/                Migration runner and seeding
```

## Local setup

Requires Node 20.9+.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run db:migrate           # applies supabase/migrations in order
npm run dev
```

### Environment variables

| Variable | Where to find it | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | seed script only, never the browser |
| `SUPABASE_DB_URL` | Supabase → Settings → Database → connection string (URI) | `npm run db:migrate` |
| `NEXT_PUBLIC_SITE_URL` | your deployed origin | auth email redirect links (optional locally) |

### Migrations

`npm run db:migrate` applies every file in `supabase/migrations` in filename order,
once each, recording what it has run in a `schema_migrations` table. Migrations are
plain SQL and forward-only. Add a new one as `NNNN_description.sql`.

Every table has RLS enabled and a user can only read or write their own rows.
Ownership of `sentinel_lifts` and `lift_entries` is derived through `blocks` rather
than duplicating `user_id`, so a lift entry can never disagree with its block.

### Seeding

Seed data lands in a later phase.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm test` | Vitest, domain layer |
| `npm run lint` | ESLint, including the domain boundary rule |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | apply pending SQL migrations |

## Conventions

- UK English throughout, in code and in interface copy.
- Never default a metric to false. "Not answered" and "answered no" are different
  states, in the database and on screen.
- Colour carries meaning only: green, red and yellow are reserved for status.

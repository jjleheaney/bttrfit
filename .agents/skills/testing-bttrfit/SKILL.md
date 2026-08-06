---
name: testing-bttrfit
description: How to run and test the BTTR Fit Next.js + Supabase app locally (dev server, env pitfalls, creating test users, auth flows).
---

# Testing BTTR Fit locally

## Toolchain
- Node 22 is required (`.nvmrc`); Vitest 4 / Next 16 break on Node 20.
  `source ~/.nvm/nvm.sh && nvm use 22`.
- `npm install`, then `npm run dev` → http://localhost:3000.

## Env pitfall: inherited env beats `.env.local`
Next.js gives `process.env` precedence over `.env.local`. If the machine/org exports
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, those win
and every request 500s with `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` (thrown from
`lib/data/supabase/proxy.ts`). Start the server with the inherited vars stripped:

```
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY \
    -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_URL npm run dev
```

Sanity check before touching the UI: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n"
http://localhost:3000/` must print `307 http://localhost:3000/login?next=%2F`.
Note `NEXT_PUBLIC_*` values are baked into the Turbopack build cache — after changing them, kill the
server and `rm -rf .next`.

## Creating test users when email is unavailable
The Supabase project may have "Confirm email" ON and a low email rate limit (default 2/hour); once
exhausted, `signUp` and `signInWithOtp` both return `email rate limit exceeded`, which blocks the
`/signup` UI path. Two workarounds, in order of preference:

1. **Admin API** (needs a valid `sb_secret_…` `SUPABASE_SERVICE_ROLE_KEY`):
   `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Jordan' } })`.
   This inserts into `auth.users`, so the `on_auth_user_created` trigger still creates the
   `public.profiles` row — the greeting on `/` ("Signed in as <first name>") is the UI proof that
   both the trigger and the owner-scoped RLS select work.
2. **Direct Postgres** via `SUPABASE_DB_URL` (works even with an invalid API secret key). Insert into
   `auth.users` with `crypt(password, gen_salt('bf'))` and `email_confirmed_at = now()`, and
   **set the token columns to `''`** (`confirmation_token`, `recovery_token`,
   `email_change_token_new`, `email_change_token_current`, `email_change`, `phone_change`,
   `phone_change_token`, `reauthentication_token`) — leaving them NULL makes GoTrue fail login with
   `500 Database error querying schema`.

Use `@mailinator.com` addresses: Supabase rejects `example.com` and invented domains as invalid, and
Mailinator inboxes are publicly readable if you do get an email through.

## Auth UI paths
- `/login` defaults to magic-link mode; click **"Use a password instead"** to reveal the password field.
- `/signup` = First name, Email, Password (≥8). On failure the form fields are cleared.
- Route protection lives in `proxy.ts` (Next 16's renamed middleware) → `lib/data/supabase/proxy.ts`;
  public prefixes are `/login`, `/signup`, `/auth`.

## Mobile viewport
Chrome cannot be resized below ~532px wide on Linux, so use DevTools device emulation
(F12 → Ctrl+Shift+M → set 390 x 844) for mobile checks, and read tap-target heights / font sizes
from the console rather than judging by eye. When typing into the width/height boxes, clear them
with `ctrl+a` first — a triple-click sometimes lands in the zoom box and produces junk like `9999`.

The product brief requires the Today check-in to fit with **no scrolling**. Measure it, don't eyeball:

```js
const d = document.documentElement;
({vOverflow: d.scrollHeight - d.clientHeight, hOverflow: d.scrollWidth - d.clientWidth})
```

Always measure the **worst case**: a *completed* day (the day-complete panel is taller than the
"N left to answer" line) *and* with the missing-day chip block visible (it can add ~170px). 390×844
may pass while 360×640 fails badly. If it overflows, also log the bounding boxes of each row and of
`nav` so you can say exactly which element crosses the fold.

### The tab bar is `sticky`, so `vOverflow > 0` does not always mean something is hidden
`nav` is `position: sticky`, so it still occupies its place in flow: document height is `main` +
`nav`, even though `getBoundingClientRect()` reports the *stuck* position at the bottom of the
viewport. A page can therefore report overflow while everything still looks visible. Confirm a real
scroll is possible, then separately state whether anything is actually obscured:

```js
window.scrollTo(0, 9999);
console.log('scrolled by', -document.querySelector('main').getBoundingClientRect().top);
window.scrollTo(0, 0);
```

A 4px overflow with nothing hidden and a 40px overflow that buries the last line of a panel are very
different findings — always report the px number *and* the visible consequence.

### Checking a control is really tappable near the tab bar
If `elementFromPoint` at a control's bottom edge returns something inside `nav`, part of that
control is not tappable — report it even when every height passes:

```js
const r = el.getBoundingClientRect();
console.log(document.elementFromPoint(r.left + r.width / 2, r.bottom - 2));
```

Two follow-ups:
- Always finish with a **real click** at that lowest point and assert the resulting state change
  (e.g. the header date changes). The hit test is the explanation; the click is the proof.
- Inside an `overflow-x-auto` row, Chrome's horizontal scrollbar intercepts the bottom ~3px of a
  child in desktop emulation, so `elementFromPoint` there returns the scroll container. That is an
  emulation artefact, not the tab-bar bug — tell them apart by checking whether the returned element
  is inside `nav`.

### Text that wraps at 360px blows layout budgets
A one-line heading at 390px often becomes two lines at 360px, adding ~20px that a px budget computed
at the wider size will miss. When a fix is justified by a predicted block height, re-measure that
block at **both** widths and quote the real number even on a pass.

## Reaching week/day states without waiting real days
Only ever move `blocks.start_date` via SQL (`end_date` is a generated column and follows). Relative
to the *browser's* today:

| Offset | State reached |
|---|---|
| `-11` | week 2 day 5 — lift prompt must be ABSENT |
| `-12` | week 2 day 6 — lift prompt must be PRESENT |
| `-60` | block finished (56 days past) — tests the retire/next-block path |

The absent-then-present pair is the discriminating test for the day-6 threshold; testing only day 6
proves nothing. Week 1 baselines are written at setup, so the prompt never fires in week 1 — you
must backdate into week 2 to test lift logging at all.

To test an out-of-block save: open an early day in the tab, *then* move `start_date` forward so the
held day falls before the block, then tap a metric in that same tab.

## Testing timezone handling without relaunching Chrome
DevTools → Ctrl+Shift+P → "Show Sensors" → Location → **San Francisco** sets an
`America/Los_Angeles` override that `Intl.DateTimeFormat().resolvedOptions().timeZone` respects.
Clear the app's zone cookie (`document.cookie='bttrfit-tz=; Max-Age=0; path=/'`) to simulate a first
visit. This is only discriminating when UTC and the override are on **different calendar dates**
(e.g. run it after 17:00 America/Los_Angeles, when UTC has already rolled over) — check with
`date -u +%F` vs `TZ=America/Los_Angeles date +%F` first. Then assert both the rendered date *and*
the persisted `blocks.start_date` / `daily_entries.entry_date`.

## Verifying writes, and RLS
The UI is not proof that the right row was written — check with `psql "$SUPABASE_DB_URL"`, but the
**inherited** `SUPABASE_DB_URL` points at the IPv6-only direct host and fails with
`Network is unreachable`. Load the pooler URI out of `.env.local` first, without echoing it:

```bash
cd /home/ubuntu/repos/bttrfit && set -a && . ./.env.local && set +a && psql "$SUPABASE_DB_URL" -Atc "select 1;"
```

Useful
column names (easy to guess wrong): `daily_entries` has `workout_done`, `protein_hit`, `sleep_hit`,
`steps_hit`, `drinks`, `weight`, `notes` (there is no `training_hit`).

The unanswered/No distinction matters: "No" must persist as `false`, a cleared answer as `NULL`.

For RLS, sign a second user in with the **anon/publishable** key (not the service role) and select
from `blocks`, `sentinel_lifts`, `lift_entries`, `daily_entries` — all must return 0 rows. Also try
an insert into `lift_entries` using the *first* user's `sentinel_lift_id`; it must fail with
`new row violates row-level security policy`. Run such scripts **from the repo root** so
`@supabase/supabase-js` resolves (a script in `/tmp` cannot find it).

## Devin secrets needed
- `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://<ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key `sb_publishable_…`)
- `SUPABASE_SERVICE_ROLE_KEY` (secret key `sb_secret_…`)
- `SUPABASE_DB_URL` (pooler connection string)
Verify each before testing: `curl -H "apikey: $KEY" $URL/auth/v1/health` should return 200 — an
"Invalid API key" here means the values were mixed up (a common failure: the same secret pasted into
all three fields).

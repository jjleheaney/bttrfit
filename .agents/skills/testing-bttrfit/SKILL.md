---
name: testing-bttrfit
description: How to run and test the BTTR Fit Next.js + Supabase app locally (dev server, env pitfalls, creating test users, auth flows, theme/token verification, settings/lift-swap, CSV export, PWA/service-worker limits).
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

## Testing the deployed app (Vercel production) rather than localhost

Production is `https://bttrfit-chi.vercel.app`. Before planning, check reachability and whether
Vercel deployment protection is on — preview URLs are often gated, the production domain usually is
not:

```bash
for p in / /login /signup /week /start; do
  printf "%-8s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' https://bttrfit-chi.vercel.app$p)"
done
# expect: /login,/signup = 200 ; /,/week,/start = 307 -> /login?next=...
```

Production may point at the **same** Supabase project as your local `.env.local`. Do not assume it
either way, and do not echo env vars to find out (the inherited `NEXT_PUBLIC_SUPABASE_URL` can hold
a non-URL secret value and printing it leaks it). Settle it non-destructively: sign up through the
live UI, then look for that email in `auth.users` via `psql`. If it is there, the projects are
shared and you can verify every write server-side.

The app centres in a `max-w-md` column (`app/(app)/layout.tsx`), so desktop-width Chrome renders it
fine. You only need DevTools device emulation for genuine responsive assertions — for a functional
smoke test, skip it and keep the recording clean.

### Confirm-email on/off is provable without guessing

`signUp` (`app/auth/actions.ts`) redirects to `/` when `data.session` exists, and otherwise returns
the literal string `Confirm your email. We have sent a link to …`. So the discriminator is the
absence of that sentence, not "the page moved". Corroborate server-side — with confirmation off,
new `auth.users` rows have `confirmed_at` already set:

```sql
select email, created_at, (confirmed_at is not null) as confirmed from auth.users where email like 'yourprefix%';
```

### Magic links are PKCE — never click them inside an email-preview iframe

The Supabase email link is `…/auth/v1/verify?token=pkce_…&redirect_to=<site>/auth/confirm?next=…`,
and `/auth/confirm` calls `exchangeCodeForSession`, which needs the `code_verifier` cookie set on
the **app origin** when the link was requested.

Mailinator's HTML tab renders the email in a cross-site `<iframe>`. Clicking `Sign in` there
navigates the iframe, the app-origin cookie is not sent, and you get
`/login?error=link_expired` → *"That link has expired or has already been used."* **This looks
exactly like a real misconfiguration but is a harness artifact.** Also note mailinator's SPA can
keep showing a previous message's navigated iframe, which makes a fresh link look already-consumed.

Reliable procedure:
1. Request the link from `/login` in the app tab (this sets the PKCE cookie on that origin).
2. In mailinator, open the message and go to the **LINKS** tab — it shows the full untruncated URL
   (the HTML tab's `href` is truncated in the DOM).
3. Assert on `redirect_to`: it must be percent-encoded `https://<prod-domain>/auth/confirm`, not
   `localhost`. This is the real check of Supabase's Site URL / redirect allowlist.
4. Paste that URL into the **app tab's address bar** — a top-level navigation, which is what a real
   mail client does. Magic links are single-use, so request a new one if you burned the token.

Inbox URL: `https://www.mailinator.com/v4/public/inboxes.jsp?to=<local-part>` — public, no login.

### Golden-path notes for a fresh production user
- `/start` is an 8-step wizard: name → units → weight → protein (auto-suggested from bodyweight) →
  drinks → three lift `select`s → per-lift `Reps`/`Weight` → start date. It refuses with
  *"Block N is already running"* if a non-expired block exists, so use a brand-new user.
- **Pick `Today`, not `Next Monday`**, or week 1 has not elapsed and the contact sheet is entirely
  `future` — which proves nothing about rendering real data.
- The wizard's top sets already create week-1 lift entries, so `/lifts` is pre-filled. To actually
  exercise the write path, **edit** a value before pressing `Save week N lifts`; re-saving identical
  numbers would pass even if the save were broken.
- Today check-in auto-saves per control (no Save button); assert the rendered state and the
  `DAY COMPLETE` panel.

### Day-1 expectations on `/week` (useful sanity oracle for any fresh block)
Verdict `Baseline week`; **0 polylines** and caption `A 7-day average needs four weigh-ins`;
42 sheet cells with 6 answered and 36 `not yet` and **zero misses**; compliance `1 of 1 days logged`
with `1/1` denominators; lift cards read `First entry` with **no percentage**. e1RM is Epley
(`w × (1 + reps/30)`), so `6×62.5 → 75.0kg` and `5×110 → 128.3kg`.

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

### `.min-h-tap` changes size across the short-viewport breakpoint
It is **48px above** `max-height: 720px` and **44px below** it. An expected block height must
therefore be computed per viewport — the same block is legitimately 66px at 390×844 and 54px at
360×640. Also, when a PR buys vertical space by cutting padding around a control, assert the block
height **and** the control's own height: shrinking the tap target produces the same overflow win but
is a worse bug.

## Reaching week/day states without waiting real days
Only ever move `blocks.start_date` via SQL (`end_date` is a generated column and follows). Relative
to the *browser's* today:

| Offset | State reached |
|---|---|
| `-11` | week 2 day 5 — lift prompt must be ABSENT |
| `-12` | week 2 day 6 — lift prompt must be PRESENT |
| `-60` | block finished (56 days past) — tests the retire/next-block path |
| `-70` | block ended ~2 weeks ago but still `active` — post-block-end week resolution |
| `+7`  | block has NOT started yet — the other side of the same fallback |

The absent-then-present pair is the discriminating test for the day-6 threshold; testing only day 6
proves nothing. Week 1 baselines are written at setup, so the prompt never fires in week 1 — you
must backdate into week 2 to test lift logging at all.

The `-70` / `+7` rows are a pair worth keeping together. `weekNumberFor` returns `null` for **both**
"before day one" and "after the last day", so any `?? fallback` on it is a bug magnet: the two cases
want opposite answers (week 1 before the start, week 8 after the end). Whenever you test one, test
the other in the same run — a sign error in the `compareDates` guard passes one and fails the other,
and it costs two minutes.

Note a block can be `status = 'active'` while its `end_date` is already in the past; "finished" on
the Today screen is computed from dates, not from `status`, so you do not need to flip `status` to
reach the finished state.

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
The UI is not proof that the right row was written — check with `psql "$SUPABASE_DB_URL"`. Try the
**inherited** env var first: it has worked directly (session pooler,
`aws-1-…​.pooler.supabase.com` as `postgres.<ref>`, on both `:5432` and `:6543`) since the project
password was last reset. If it fails, it is likely a stale value — historically it pointed at the
IPv6-only direct host and failed with `Network is unreachable`. Then load the pooler URI out of
`.env.local` instead, without echoing it:

```bash
cd /home/ubuntu/repos/bttrfit && set -a && . ./.env.local && set +a && psql "$SUPABASE_DB_URL" -Atc "select 1;"
```

**If `psql` fails both ways, fall back to PostgREST.** Postgres password auth may fail for *both*
the inherited URI and the `.env.local` pooler URI (`FATAL: password authentication failed for user
"postgres"`) while the REST API still works fine. Probe which credential is live before assuming
you are locked out — the injected `SUPABASE_SERVICE_ROLE_KEY` and the one in `.env.local` are often
different, and only one may be valid:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $KEY" "$URL/rest/v1/blocks?select=id&limit=1"
```

Then seed with `@supabase/supabase-js` using the working key, run **from the repo root** so the
dependency resolves. `seed-week-fixture.mjs` is a worked example (parses `.env.local` itself, never
prints secrets). Note PostgREST cannot write generated columns such as `blocks.end_date` — set
`start_date` and let it follow.

Useful column names (easy to guess wrong): `daily_entries` has `workout_done`, `protein_hit`, `sleep_hit`,
`steps_hit`, `drinks`, `weight`, `notes` (there is no `training_hit`).

### `SUPABASE_DB_URL` may not be a Postgres URI at all — plan for supabase-js
Seen in Aug 2026: the injected `SUPABASE_DB_URL` held the **https project URL**, so every `psql`
invocation is dead on arrival and there is no pooler URI in `.env.local` either. Do not burn time on
it — go straight to `@supabase/supabase-js` with the service-role key parsed out of `.env.local`,
run from the repo root. Ownership columns for a per-user row sweep (these are easy to get wrong):

| table | owner column |
|---|---|
| `profiles` | **`id`** (not `user_id`) |
| `blocks`, `daily_entries` | `user_id` |
| `sentinel_lifts` | via `block_id` |
| `lift_entries` | via `sentinel_lift_id` |

A per-uid count only proves that uid is clean. Pair it with a **global orphan sweep** — select every
row and check its owner is still in `auth.admin.listUsers()` — which is what actually catches a
broken cascade after any bulk account deletion. Verified clean after a full production
signup → `/start` → check-in → delete round trip.

The unanswered/No distinction matters: "No" must persist as `false`, a cleared answer as `NULL`.

For RLS, sign a second user in with the **anon/publishable** key (not the service role) and select
from `blocks`, `sentinel_lifts`, `lift_entries`, `daily_entries` — all must return 0 rows. Also try
an insert into `lift_entries` using the *first* user's `sentinel_lift_id`; it must fail with
`new row violates row-level security policy`. Run such scripts **from the repo root** so
`@supabase/supabase-js` resolves (a script in `/tmp` cannot find it).

## Testing the `/week` screen
Reached by the **Week** tab (middle of the 3-tab bar). `?week=N` is clamped to 1..8 and anything
out of range — including `0` and `9` — silently falls back to the *current* block week, so a test
that only checks "page still renders" proves nothing; assert the rendered `h1`.

The forward arrow renders as an inert `<span aria-hidden>` (not a disabled link) once you reach the
current week, so assert `querySelector('a[aria-label="Next week"]') === null` **and** click it to
show nothing happens. Same shape for `Previous week` on week 1.

Design one fixture that makes every branch visibly different in a couple of screenshots:

| Want to prove | Fixture |
|---|---|
| baseline refusal + chart draws **0** polylines | week 1 with only 3 weigh-ins |
| trend line **gap** (not interpolation) | a week with <4 weigh-ins between two dense weeks |
| conclusive verdict | dense week, 2 lifts up |
| unchanged-lift card prints **no** percentage | repeat an earlier week's reps×weight exactly |
| verdict refusal that must not fall back on weight | current week, only **1** comparable lift, with a large weight delta |
| all 4 contact-sheet cell states in one shot | partially-elapsed current week, one metric left `NULL` |

Counting SVG nodes is the discriminating assertion for the chart — an implementation that bridges a
sparse stretch renders **1** polyline where a correct one renders **2**:

```js
const s = document.querySelector('figure svg');
const pts = [...s.querySelectorAll('polyline')].flatMap(p =>
  p.getAttribute('points').split(' ').map(v => +v.split(',')[0]));
console.log(s.querySelectorAll('polyline').length, s.querySelectorAll('circle').length,
  Math.max(...pts), Math.max(...[...s.querySelectorAll('circle')].map(c => +c.getAttribute('cx'))));
```

The series must be **clipped at today**, so on the *current* week the rightmost polyline vertex and
the rightmost dot must have the same `x`. A line running past today is the regression to watch for.

Do **not** generalise that to "the line always ends on the last weigh-in". `rollingAverage7` is a
*trailing* mean, so a date with no weigh-in of its own still gets an average as long as its previous
7 days hold four weigh-ins. The line therefore legitimately extends past the last weigh-in, up to
the clip point — it only coincides with the last dot when that dot is today. This bit me: I
predicted 0 polylines on a week whose only weigh-ins ended the day before, and the app correctly
rendered 1. When testing a *finished* block, the useful assertion is that nothing is plotted at the
block-end `x` (`320`), not that the line stops exactly on the last dot. Convert `x` back to a day
index with `Math.round(x / 320 * (nDates - 1))` and name the date before claiming a failure.

The chart `<svg>` also carries `role="img"`, so it is picked up by `querySelectorAll('[role="img"]')`
— filter it out when counting the 42 contact-sheet cells (6 rows × 7 days), or you will get 43.

Classify sheet cells by their computed class rather than by eye; the four states are
`border-dotted border-line` (future), `border-dotted border-attention` (unanswered),
`border-text` (miss) and `bg-hit` (binary hit), with proportional rows using a `bg-text` inner bar
whose `style.height` is the fill percentage. Two rules worth asserting explicitly: future days must
**never** be misses (count them — un-elapsed days × 6 rows), and the proportional weight/drinks bars
must use foreground ink, **not** the hit green, in both themes:

```js
getComputedStyle(bar).backgroundColor  // must equal var(--text), never var(--hit)
getComputedStyle(hit).backgroundColor
```

Assert against the *current* token values (read them at runtime, see the theming section) rather
than hardcoded hexes — the palette has already been retuned once and stale expected values in a
test plan will produce false failures.

Switch themes through the UI (**Settings → Theme → Dark**), not the console — the user watches the
recording. Capture the light-mode colours *before* switching so you can diff them.

## Testing the theme / design tokens

Dark is the **default and the `:root` set**; `.light` is the override class, and
`enableSystem={false}` so the OS preference is deliberately ignored. Only **Dark** and **Light**
are offered (a withdrawn `"system"` value is migrated to `"dark"` on mount).

**Never assert a theme from a screenshot alone.** A dark page looks identical whether the roles are
wired to the new tokens or to a previous dark palette. Read the tokens at runtime and assert the
computed `rgb()`:

```js
const cs = getComputedStyle(document.documentElement);
Object.fromEntries(['ground','surface','surface-raised','field','text','text-muted','line',
  'accent','accent-contrast','hit','hit-contrast','miss','miss-contrast','attention']
  .map(t => [t, cs.getPropertyValue('--' + t).trim()]));
```

Do the same for the *elements*, scanning for anything whose background luminance is out of set:

```js
[...document.querySelectorAll('*')].filter(el => {
  const b = getComputedStyle(el).backgroundColor;
  const m = b.match(/\d+/g);
  if (!m || b === 'rgba(0, 0, 0, 0)') return false;
  const [r,g,bl] = m.map(Number);
  return (0.2126*r + 0.7152*g + 0.0722*bl) > 80;   // tune per palette
}).map(el => el.tagName + '.' + el.className);
```

Run that scan **inverted** after switching to Light (look for elements stuck on a *dark* token) —
a half-themed app is the realistic failure when dark lives on `:root`.

### Prove the pre-hydration first paint by disabling JavaScript
The white-flash window before `next-themes` writes a class is a frame you will miss. Disable JS in
DevTools and hard-reload: the state becomes permanent and inspectable. Correct behaviour is
**no `light`/`dark` class on `<html>`** while `document.body` already computes to the dark ground.
If the body is light here, that *is* the flash.

### The built-in 404 does not follow the theme
There is no `app/not-found.tsx`, so Next's built-in error page applies its own stylesheet
(`body{color:#000;background:#fff}` with a `@media (prefers-color-scheme:dark)` override). Because
the app forces dark by **class** and ignores the OS preference, an OS-light visitor gets a **white**
404 inside an all-dark app. Always visit a bogus path (`/nope-does-not-exist`) as part of any theme
sweep — it is the route nobody styles. If this is still white, it is a real finding.

### Hover cannot be exercised in this harness
Chromium here reports `matchMedia('(hover: hover)').matches === false` /
`(pointer: coarse) === true`, and Tailwind compiles `hover:` utilities inside `@media (hover:hover)`,
so the rules are inert. Verify the compiled rule exists instead of guessing, and report hover as
*untested at runtime, statically verified* rather than failed:

```bash
curl -s http://localhost:3000/_next/static/css/<hash>.css | grep -o 'hover:hover[^}]*}[^}]*}'
```

Note this is not purely an artefact: a real phone also reports `hover: none`, so these affordances
only ever reach desktop pointer users.

### Contrast is the point of the status tokens — compute it, don't eyeball it
The fills carry dedicated `--hit-contrast` / `--miss-contrast` text colours precisely because white
on green/red failed AA. Compute the ratio in the console (sRGB → relative luminance →
`(L1+0.05)/(L2+0.05)`) and assert ≥4.5. Also compute what the *old* value would have scored — a
before/after pair is far stronger evidence than a passing number alone.

For elements rendered with `opacity`, composite against their backdrop before judging: an
`opacity: 0.3` disabled control on `#0A0A0A` is far weaker than its nominal colour suggests. WCAG
exempts disabled controls, so report those as an observation, not a violation.

### Charts read from the accent token
The dark accent is **white** (`#FFFFFF`), not a link blue — a reviewer working from an older PR
description may misread white chart strokes as a broken `stroke-accent` utility. Consequently the
rolling-average line and the grey raw dots (`--text-muted` at `opacity: 0.7`) are the one pair worth
re-checking whenever the accent changes; measure their separation ratio. Lift-chart lines are told
apart by `stroke-dasharray` (`none` / `6 3` / `1.5 3`), **not** by colour, so all three legitimately
share one stroke.

### Theme-toggle cases that actually catch bugs
Asserting "Dark looks selected" passes even when nothing persists. Assert both halves:

| Case | Setup | Expect |
|---|---|---|
| fresh visitor on a light phone | clear `localStorage` **and** emulate `prefers-color-scheme: light` | still dark; `storedTheme === null` |
| withdrawn value migrates | `localStorage.theme = 'system'` before load | `Dark` has `aria-checked="true"` **and** stored value rewritten to `"dark"` |
| migration is durable | reload again | still `"dark"` (not re-migrated each visit) |
| persistence | pick Dark, **hard**-reload | class and body colour survive |

### The Today date hydration mismatch — fixed, but branch-dependent
`lib/format.ts` used one combined `Intl` formatter, and Node's ICU emitted `Thu, 6 Aug` while
Chrome emitted `Thu 6 Aug`, logging a React hydration error. **PR #25 fixed this** by joining two
separate UTC formatters (weekday + date), which agree across runtimes.

Consequences when testing:
- Branches that predate #25 still render `Thu, 6 Aug`. That is **expected on those worktrees**, not
  a regression — check `git log --oneline -- lib/format.ts` before reporting it.
- The bug was a *server/client disagreement*, so the rendered text looked fine either way. The only
  real proof is a **clean console after a hard reload** — assert zero entries matching
  `hydrat|did not match|Text content does not match`, not just the visible string.
- Turn on **Preserve log** first, then `console.clear()`, then hard-reload; otherwise you cannot
  tell "no errors" from "console was wiped by the navigation".
- Beware a false positive: this harness injects `devinid` / `devin-tagname` attributes, which can
  themselves produce a hydration warning. Diff the reported mismatch and confirm whether any *date
  string* actually appears in it before blaming the product.

Unlike Today, this screen is **allowed** to scroll vertically, so `vOverflow` is not a failure here.
What matters is `hOverflow === 0` (the 7-column sheet must fit 360px without its own scroller) and
that, scrolled fully to the bottom, the last section clears `navTop`.

## Service workers do not activate in this harness — the offline test is untestable here
The SW registers, but DevTools ▸ Application ▸ Service workers sits forever at
**"#0 trying to install"**, `caches.keys()` stays `[]`, and `navigator.serviceWorker.register()`
returns a promise that **neither resolves nor rejects**.

Do not report this as a product defect without a control. Load a known-good third-party PWA in the
same browser and probe it identically:

```js
// on https://squoosh.app — Google's reference PWA
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r =>
  console.log(r.scope, r.installing?.state, r.waiting?.state, r.active?.state)));
caches.keys().then(k => console.log(JSON.stringify(k)));
```

If Squoosh shows the same `installing=null waiting=null active=null` + empty caches, it is the
harness, and anything SW-dependent (offline fallback, precaching, `skipWaiting`) must be reported
**untested**, not failed.

What you *can* still verify without an active worker:
- `/offline` returns 200 `text/html` and renders as a correctly themed app page (the fallback
  target is sound even if the fallback path cannot fire).
- `/manifest.webmanifest` returns `application/manifest+json`, parses in DevTools ▸ Application ▸
  Manifest, and every icon URL returns 200. `form_factor`/screenshot warnings are optional and
  non-blocking — they are not installability errors.
- `/sw.js` is served with a JS content type and its `install` shell list is fetchable.

## Testing Settings: targets, sentinel-lift swap, delete account

### The swap gate is per-lift — prove it with one screenshot
`canSwapSentinelLift` allows a swap only when the lift has **no entries with `weekNumber > 1`**.
Seed a week-2 row for *one* slot and leave its peers baseline-only, then screenshot all three
rows together: the gated lift's **Swap button is replaced by** the refusal sentence while its peers
keep theirs. One frame proves the gate is per-lift rather than a global toggle.

```sql
insert into lift_entries (sentinel_lift_id, week_number, reps, weight)
select s.id, 2, 5, 102.5 from sentinel_lifts s
join blocks b on b.id = s.block_id join auth.users u on u.id = b.user_id
where u.email = '<test user>' and s.slot = 2;
```

The refusal names the weeks logged (`week 2`, or `weeks 4 to 5` for a range) — assert the exact
string, since "some explanation appeared" would pass on a stubbed message.

### Swap assertions that cannot be faked
- **Type a baseline unlike the old one** (e.g. bench 5×70 → overhead press 8×45). An inert or
  inherited write then fails loudly instead of coincidentally matching.
- Assert the slot and its week-1 entry in **one read**, plus the row count — the pre-atomic
  two-step could leave a renamed slot carrying the old lift's top set, or duplicate the entry:

```sql
select s.slot, s.lift_key, le.week_number, le.reps, le.weight,
       count(*) over (partition by s.id) as entry_rows
from sentinel_lifts s left join lift_entries le on le.sentinel_lift_id = s.id
join blocks b on b.id = s.block_id join auth.users u on u.id = b.user_id
where u.email = '<test user>' order by s.slot, le.week_number;
```

- **Taken lifts** are filtered from the `<select>`; after swapping slot 1 away from bench, bench
  must *reappear* in the menu on the next open. Check both directions.
- A successful swap **closes the form**; reopen it without reloading to prove a second swap works
  and that the confirmation cleared.

### Delete account — use a throwaway you created through the UI
Never a fixture you still need. Assert the wrong-email refusal *and* that the account still exists,
then after the real deletion assert **all** tables, not just `auth.users`:

```sql
select 'auth.users', count(*) from auth.users where email = '<throwaway>'
union all select 'blocks', count(*) from blocks where user_id = '<uid>'
union all select 'daily_entries', count(*) from daily_entries where user_id = '<uid>'
union all select 'sentinel_lifts', count(*) from sentinel_lifts
  where block_id in (select id from blocks where user_id = '<uid>');
```

Also navigate back to `/settings` afterwards — it must bounce to `/login?next=%2Fsettings`. Landing
on `/login` once only proves a redirect happened, not that the session died.

All three forms clear their feedback on edit, including this one (#26): the refusal
`That is not the email this account uses.` must disappear on the first keystroke after you correct
the address. Assert that it goes — stale text above `Delete for good` is the failure mode here.

## Testing the CSV export

### "Contains all blocks" needs a block that owns exclusive rows
`daily_entries` carries an explicit `block_id`, and fixture blocks often **overlap in date range**
while all the entries belong to the newer one. An export showing a single block is then correct,
not a bug. Check before reporting:

```sql
select min(entry_date), max(entry_date), count(*) from daily_entries where user_id = '<uid>';
```

If the older block owns nothing, seed one row against it explicitly (`block_id` = the old block),
re-export, confirm both blocks appear, then delete the row. The **Lifts** CSV usually spans blocks
unaided, so it is the cheaper multi-block check.

### Blank cells and formula defusing
- A NULL boolean must export as an **empty field** (`yes,,,yes`), never `no`. Pick a day whose
  `workout_done`/`sleep_hit` are NULL and assert the literal `,,`.
- A note beginning with `= + - @` tab or CR is prefixed with a literal **tab** inside quotes:
  `"\t=1+1"`. Type it through the Today notes UI, re-download, and inspect the raw bytes
  (`cat -A` if unsure a tab is really there) — opening in a viewer that trims whitespace hides it.
- Downloads land in `~/Downloads`; a repeat download becomes `name (1).csv`, so glob carefully.

## Testing the eight-week review and starting the next block

### Reaching a finished block, and the boundary that matters
"Finished" is computed from dates, not `status`, in three places that disagree if one regresses:
`/` shows `Block N is finished`, `/block` shows `The block is over. Read the review and start
block N+1`, and `/block/review` renders only when `summary.finished`. The discriminating pair is
**exactly day 56** (block not yet over: review must refuse with `The review lands when week 8
closes`, `/block` must show `day 56 of 56` and **no** review link) versus **day 57** (all three
switch over). Test both in one run; testing only the finished side proves nothing.

There is no app-provided "today offset" — `currentDate()` comes from the browser tz cookie and the
system date. Moving only `blocks.start_date` re-maps every existing entry's week and destroys a
seeded weekly-average fixture. To advance a day while preserving the fixture, shift
`blocks.start_date` **and every `daily_entries.entry_date`** back by the same number of days
(shift the oldest rows first so the `unique(user_id, entry_date)` index never collides).

### Pre-compute the review's numbers before you look at the screen
The review's headline sentence is chosen from `weightChange` vs `WEIGHT_DELTA_THRESHOLD = 0.2` and
how many sentinel lifts `held or climbed` on first→last e1RM. With weight down and 3/3 lifts up it
must read exactly:
`Bodyweight down and every sentinel lift held or climbed. That is body recomposition, without a DEXA scan.`
Also derive `recompingWeeks of judgedWeeks` by hand from `compareLiftWeek` semantics — it compares
against the most recent **earlier logged** week, not the immediately preceding one, so a skipped
lift week does not create an unjudged week. A fixture with a deliberate weight *rise* week is worth
having: that week must read `Off track`, never a recomp label.

### Block 2 prefill and the one-active-block guard
`/start` for a returning user prefills name, unit, `getLatestRecordedWeight()` (block 1's **last
recorded weight**, not the last week average), the previous protein/drinks targets and the same
three lifts in the same slots, and the header reads `Step n of 7 · Block 2`. Top sets are
deliberately blank. The wizard is 7 steps with the top sets last; there is no start-date step —
the block always starts today.

To test atomicity through the UI: walk **two tabs** to step 7, submit in tab A then immediately in
server must end with exactly two blocks, block 1 `completed`, block 2 `block_number = 2` `active`
with exactly 3 `sentinel_lifts` and 3 week-1 `lift_entries`. A silent second block, or a block with
no lifts, is the failure to hunt for.

### After block 2 exists, block 1 is data-intact but UI-unreachable
Every screen reads the **active** block, so `/block`, `/week` and `/block/review` all show block 2
and there is no in-app route back to block 1's review. Report that as a product observation, and
prove block 1 survived server-side (day count, lift entries, unchanged `block_number`/dates) plus
through the **Days** CSV in Settings, which still carries block 1's rows.

### Shared Supabase project: fixtures can vanish under you
This project is shared with other sessions/environments. A seeded throwaway user was deleted
mid-run by something outside the session; the browser silently bounced to `/login` and the block
was gone. Defences:
- Re-assert the block/user still exists at the top of every server-side check, so a disappearance
  is distinguishable from a product bug.
- Keep the seed reproducible (create user via `admin.createUser`, run the wizard, then the seed
  script) so a rebuild costs minutes.
- `supabase.auth.admin.generateLink({type:'magiclink'})` on a missing email will **create** an empty
  user — do not use it as an existence check. Recovering a lost session is easiest via
  `admin.updateUserById(uid, { password })` and the `/login` → *"Use a password instead"* form
  (admin-generated magic-link `token_hash` values were rejected as `link_expired` here).

## Devin secrets needed
- `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://<ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key `sb_publishable_…`)
- `SUPABASE_SERVICE_ROLE_KEY` (secret key `sb_secret_…`)
- `SUPABASE_DB_URL` (pooler connection string)
Verify each before testing: `curl -H "apikey: $KEY" $URL/auth/v1/health` should return 200 — an
"Invalid API key" here means the values were mixed up (a common failure: the same secret pasted into
all three fields).

# Custom SMTP for BTTR Fit auth email

Supabase's built-in email sender is a shared, heavily rate-limited service (2 emails per
hour per project by default, and it is explicitly not for production). Every signup
confirmation, magic link and password reset the beta testers trigger goes through it, so
the first handful of testers will exhaust it and see
*"Too many emails have been sent from this project"* (`friendlyAuthError` in
`app/auth/actions.ts`).

This is the runbook for putting a real sender behind Supabase Auth. Only the owner can do
it: it needs DNS records on a domain you control and an API key on your own account.

Estimated time: 30 minutes, most of it waiting for DNS to propagate.

---

## 1. Pick a provider — use Resend

Recommended: **Resend** (https://resend.com).

- Free tier is 3,000 emails/month, 100/day — an order of magnitude more than a beta needs.
- Domain verification is three DNS records and its dashboard tells you the exact values;
  no support ticket or sender-reputation review before you can send.
- It exposes plain SMTP (`smtp.resend.com`), which is what Supabase Auth wants. Some
  modern providers are API-only and cannot be plugged into Supabase Auth at all.
- Per-message delivery logs in the dashboard, which is what makes step 5 verifiable
  instead of guesswork.

Reasonable alternatives if you already have an account: **Postmark** (best deliverability
for transactional mail, but no free tier past the 100-email trial) or **AWS SES** (cheapest
at volume, but starts in a sandbox that only sends to pre-verified addresses — a bad fit
for signing up strangers). Do not use a personal Gmail/iCloud account as the SMTP relay;
those cap out around 500/day and will land the mail in spam.

## 2. Verify a sending domain

You need a domain you own. The app itself is on `bttrfit-chi.vercel.app`, which is a Vercel
subdomain — you cannot add DNS records to it, so auth email cannot be sent from an address
at that hostname. Register or reuse a domain (e.g. `bttrfit.app`) and use a dedicated
subdomain for sending, so a deliverability problem with marketing or personal mail never
touches transactional auth mail.

In Resend: **Domains → Add Domain** → enter `send.bttrfit.app` → region **EU (Ireland)** or
**US East** (pick the one nearest your testers; it only affects the MX hostname below).

Resend then shows the records to add at your DNS host. For `send.bttrfit.app` in `us-east-1`
they are:

| Type | Name | Value | Priority |
|---|---|---|---|
| `MX` | `send.bttrfit.app` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| `TXT` | `send.bttrfit.app` | `v=spf1 include:amazonses.com ~all` | — |
| `TXT` | `resend._domainkey.bttrfit.app` | the `p=MIGfMA0GCSq…` DKIM public key shown in the dashboard (copy it verbatim — it is unique to your domain) | — |

Add one more yourself; Resend does not ask for it, but without it a receiving server has no
policy to apply and Gmail's bulk-sender rules treat the domain as unauthenticated:

| Type | Name | Value |
|---|---|---|
| `TXT` | `_dmarc.bttrfit.app` | `v=DMARC1; p=none; rua=mailto:j.j.heaney@me.com` |

Notes that cost people an afternoon:

- If your DNS host appends the zone automatically (Cloudflare, Namecheap), enter the
  **Name** as `send` / `resend._domainkey` / `_dmarc`, not the full hostname, or you will
  create `send.bttrfit.app.bttrfit.app`.
- On Cloudflare these records must be **DNS only** (grey cloud), not proxied.
- The MX record on `send.bttrfit.app` is for bounce and complaint feedback. It does not
  affect mail delivered to `@bttrfit.app` addresses, because it is on the subdomain.

Wait for the dashboard to show **Verified** (usually minutes; up to 48h). Then
**API Keys → Create API Key**, permission **Sending access**, domain restricted to
`send.bttrfit.app`. Copy the `re_…` value — it is shown once.

## 3. Supabase Auth → SMTP settings

Project `gkzsbewtiefhtjwoqtsr` → **Authentication → Emails → SMTP Settings** → enable
**Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `no-reply@send.bttrfit.app` |
| Sender name | `BTTR Fit` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` (the literal word — not your email address) |
| Password | the `re_…` API key from step 2 |
| Minimum interval between emails per user | `60` seconds |

The username really is the fixed string `resend`; the API key is the password. Port 587 is
STARTTLS and is the one to use — port 25 is blocked by Supabase, and 465 (implicit TLS) is
supported but has no advantage here.

Then raise the throttle that the built-in sender imposed: **Authentication → Rate Limits →
Rate limit for sending emails** → `100` per hour. This field is capped at 30/hour while the
built-in sender is on and only becomes editable after custom SMTP is saved.

## 4. Redirect URL configuration that must stay in place

**Authentication → URL Configuration**:

- **Site URL**: `https://bttrfit-chi.vercel.app`
- **Redirect URLs** (allowlist), all three entries:
  - `https://bttrfit-chi.vercel.app/**`
  - `http://localhost:3000/**`
  - `https://*-jjleheaney.vercel.app/**` (Vercel preview deployments, if you test on them)

This is independent of SMTP but breaks in the same visible way, so check it in the same
sitting. `signUp` and `sendMagicLink` pass an `emailRedirectTo` of
`<origin>/auth/confirm?next=…`, built from `NEXT_PUBLIC_SITE_URL` or the request host. If
that URL is not matched by the allowlist, GoTrue silently substitutes the Site URL, and the
tester lands on the Today screen instead of `/start` — or, when the Site URL is stale, on
`localhost:3000`, which looks exactly like a broken email. Keep `NEXT_PUBLIC_SITE_URL` in
the Vercel project set to `https://bttrfit-chi.vercel.app` so the two agree.

The `/**` suffix matters: `https://bttrfit-chi.vercel.app` alone matches only the bare
origin and would reject `/auth/confirm?next=/start`.

## 5. Verify it worked

1. **Provider handshake.** In Supabase, **Authentication → Emails → send a test email** to
   your own address. A failure here is credentials-only: wrong username (must be `resend`),
   wrong port, or a key scoped to a different domain.
2. **A real app flow, not just the test button.** Sign up at
   `https://bttrfit-chi.vercel.app/signup` with an address you can read (a
   `@mailinator.com` inbox is public and fine). The email must arrive within seconds.
3. **Check the headers of the received mail** — this is the step that proves DNS, not just
   SMTP. In the raw source, `Authentication-Results` must show `spf=pass`, `dkim=pass` and
   `dmarc=pass`, and the `From:` must be `no-reply@send.bttrfit.app`. If DKIM says `none`,
   the `resend._domainkey` record has not propagated.
4. **Resend dashboard → Logs** should show the message as `Delivered`, not `Bounced`. Leave
   this tab open while testing; it is the only place a rejected recipient is visible.
5. **Rate limit is actually lifted.** Trigger four password resets in a minute from
   `/login`. Before, the third would have returned *"Too many emails have been sent from
   this project"*; all four should now send.
6. **The link lands in the right place.** Open the link from a desktop browser: it must go
   to `https://bttrfit-chi.vercel.app/auth/confirm?...` and end on `/start`, never
   `localhost` and never `/login?error=link_expired`.

---

## Does custom SMTP fix magic links in embedded webviews?

**No. It is unrelated, and the webview failure will still be there afterwards.**

The cause is the PKCE flow, not the sender. `sendMagicLink` runs through the SSR Supabase
client, which generates a `code_verifier` and stores it in a cookie on the app origin. The
emailed link points at Supabase's `/auth/v1/verify`, which redirects to
`/auth/confirm?code=…`, and that route calls `exchangeCodeForSession(code)` — which can only
succeed if the **same cookie jar** that requested the link is attached to the request.

When a tester requests the link inside an embedded webview (the in-app browser in Gmail,
Outlook, Instagram, Slack) and then opens the email, the mail client hands the URL to a
*different* browser context — the system browser, or a fresh webview with its own storage.
The `code_verifier` cookie is not there, `exchangeCodeForSession` fails, and the route
redirects to `/login?error=link_expired`. Changing who sends the email changes nothing
about that: the same cookie is missing regardless of whether Supabase or Resend delivered
it.

What actually fixes it: **switch the magic-link email template to the token-hash form**,
which is verified server-side and needs no browser-held secret. `app/auth/confirm/route.ts`
already handles it — the `tokenHash && type` branch calls `verifyOtp`, which validates the
token against GoTrue directly and sets the session cookie on whatever browser opened the
link.

In **Authentication → Emails → Templates → Magic Link**, replace the default
`{{ .ConfirmationURL }}` body with:

```html
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/">Sign in to BTTR Fit</a></p>
```

Do the same for **Confirm signup** with `type=signup&next=/start` and for **Reset password**
with `type=recovery&next=/settings`. The trade-off is real and worth stating: a token-hash
link is a bearer credential, so anyone who reads the email can use it once within its
lifetime, whereas PKCE additionally requires the originating browser. For a one-hour,
single-use link to an address the user already controls that is the standard trade, and it
is what makes magic links work at all outside a single browser context.

Two smaller mitigations, useful either way:

- Keep telling early testers to use **password login** (`/login` → "Use a password
  instead"). It has no cookie handoff and works in every webview today.
- Shorten the window for confusion by keeping the OTP expiry at one hour or less
  (**Authentication → Providers → Email → Email OTP Expiration**).

Custom SMTP is still worth doing — it is what removes the rate limit and stops confirmation
mail landing in spam — but it should not be sold as the webview fix.

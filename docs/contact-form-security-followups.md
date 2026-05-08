# Contact form security follow-ups

Snapshot of the open security work for `/api/contact`. Pick this back up after
you've finished UI/email testing.

## Current state

- Endpoint: [`frontend/src/pages/api/contact.ts`](frontend/src/pages/api/contact.ts)
- Form: [`frontend/src/components/contact/ContactForm.tsx`](frontend/src/components/contact/ContactForm.tsx)
- Resend wrapper: [`frontend/src/lib/resend.ts`](frontend/src/lib/resend.ts)
- Env config: [`frontend/.env`](frontend/.env), [`frontend/.env.example`](frontend/.env.example), [`frontend/src/env.d.ts`](frontend/src/env.d.ts)

What is enabled today:

- Server-side validation of `firstName`, `lastName`, `email`, `message` (10-1000 chars).
- Hidden `company` honeypot - silently succeeds when filled.
- One outbound email per submission: notification to `RESEND_NOTIFY_TO` with `replyTo` set to the visitor's email.
- Per-request `Idempotency-Key` on the notification send.
- Verified-domain `from` address (`RESEND_FROM_ADDRESS`).

## Intentionally disabled: visitor auto-reply

The auto-reply that emails the visitor was removed because the endpoint is
public. Sending mail from a verified domain to a caller-supplied address turns
the API into an unauthenticated outbound mailer (harassment, spoofed
"confirmations", reputation damage). The placeholder comment lives at the
bottom of [`frontend/src/pages/api/contact.ts`](frontend/src/pages/api/contact.ts).

Re-enable only after the controls in the next section are in place.

## Deferred / leaked secret

The original `RESEND_API_KEY` was shared in chat earlier in development.
Rotation was deferred per request. Rotate it in the Resend dashboard and
update [`frontend/.env`](frontend/.env) plus the Vercel project's
**Settings -> Environment Variables** before going live.

## Re-enable plan (do not ship without these)

### 1. CAPTCHA / bot challenge

- Recommended: **Cloudflare Turnstile** (free, fewer prompts than reCAPTCHA, friendlier privacy story).
- Client: render `<Turnstile />` inside [`frontend/src/components/contact/ContactForm.tsx`](frontend/src/components/contact/ContactForm.tsx) and include the resulting token in the JSON body.
- Server: in [`frontend/src/pages/api/contact.ts`](frontend/src/pages/api/contact.ts), POST the token to `https://challenges.cloudflare.com/turnstile/v0/siteverify` before any `resend.emails.send` call. Reject with 400 if `success !== true`.
- Env additions:
  - `PUBLIC_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`

### 2. Per-IP rate limiting

In-memory limiting will not work on Vercel (serverless invocations do not share state). Use a small persistent KV.

- Recommended: **Upstash Redis** + `@upstash/ratelimit` (free tier covers a personal site).
- Suggested limit: **3 successful submissions per IP per hour**, plus a tighter sliding window like 5 attempts per 5 minutes for failed submissions to slow brute-forcers.
- Read client IP from the `request.headers.get("x-forwarded-for")` first hop (Vercel sets this); fall back to `Astro.clientAddress`.
- Env additions:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

### 3. Email-ownership confirmation (gate the auto-reply)

Before re-introducing the auto-reply send, require the visitor to prove they own the address.

- Persist a pending submission keyed by a single-use token (Upstash KV or a small SQLite/Convex table). Store: `firstName`, `lastName`, `email`, `message`, `createdAt`.
- Send a "click to confirm" email to the visitor that includes the token URL. The confirmation email itself is unavoidably attacker-triggerable, so keep it ultra-minimal text and rate-limit per IP and per email (see #2).
- New endpoint: `GET /api/contact/confirm?token=...` -> on first valid hit:
  1. Mark token consumed.
  2. Send the **notification** email to you (replacing the immediate notification we send today).
  3. Optionally send the auto-reply (now safe - the recipient definitively controls the inbox).
- TTL the token at ~30 minutes.

### 4. Keep the honeypot

The hidden `company` field stays. It's cheap, catches naive form-fill bots before any of the above kicks in, and adds zero UX cost.

## Suggested order when you return

1. Rotate the leaked Resend API key.
2. Wire Turnstile (cheapest big win).
3. Add Upstash rate limiting.
4. Implement the confirmation flow and re-enable the auto-reply.
5. Update the success copy in [`frontend/src/components/contact/ContactForm.tsx`](frontend/src/components/contact/ContactForm.tsx) to mention the confirmation email again.

## Out of scope notes

- DMARC/DKIM/SPF: handled via Resend's domain verification on `elderpickle.com`. Re-check the DNS records in the Resend dashboard occasionally; some Cloudflare DNS edits can silently invalidate alignment.
- Spam filtering on the visitor's side: not something we control; Turnstile + a clean `from` domain reputation is the right hedge.
- Logging: today we `console.error` on send failures. If volume grows, route those to Sentry / Datadog / Vercel logs explicitly.

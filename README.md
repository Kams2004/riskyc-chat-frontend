# riskyc-chat-web

The browser-based sign-in form for RiskyC Chat — phone/email + OTP, hitting
the same `auth-service` backend the mobile app uses. Plain TypeScript, no
framework: this is a two-step form, not an app, so the smallest possible
dependency footprint (and therefore the smallest attack surface) was the
right tradeoff, not a missing feature.

This is **not** a full web chat client — there's no chat list, no
conversation view, no calling. Signing in here just gets you an account;
using it happens in the mobile app.

## Local development

```bash
npm install
npm run dev
```

Defaults to the deployed VPS backend (`167.86.120.214:8091`) so it works
against the real thing with zero setup. To point at a local backend
instead, copy `.env.example` to `.env.local` and set `VITE_AUTH_SERVICE_URL`.

## Security measures

This form is a public, unauthenticated endpoint that triggers an email/SMS
send — the classic target for spam and abuse — so it's hardened at every
layer rather than just one:

- **Rate limiting** (`auth-service`'s `OtpRateLimiter`): a 45s cooldown per
  identifier (stops hammering one victim's inbox) and a 12-request/hour cap
  per IP (stops one attacker cycling through many addresses). Enforced
  server-side — this can't be bypassed by skipping the web form's own JS.
- **Brute-force protection** (`OtpService`): a code is burned after 5 wrong
  guesses, closing off the "just guess the 6-digit code" attack within its
  5-minute expiry window.
- **CORS allow-list** (`WebConfig`): only explicitly configured origins can
  call the API from a browser at all — never a wildcard, since bearer
  tokens flow through these endpoints.
- **Input validation**, both client-side (fast feedback) and server-side
  (`AuthController`'s email/phone regex — the client-side check is only a
  courtesy, since anyone can bypass it and call the API directly).
- **Honeypot field**: an offscreen input real users never fill in; a bot's
  generic form-filler usually fills every field it finds. Silently no-ops
  on trip — no error, no hint that anything special happened.
- **nginx-level rate limiting** (`nginx.conf`'s `limit_req`): throttles at
  the network layer, in front of everything else, independent of and in
  addition to the app-level limiter.
- **Security headers** (`nginx.conf` / `security-headers.conf`): CSP,
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy on every response.
- **Request timeouts** (`api.ts`): every request aborts after 20s rather
  than hanging indefinitely on a dropped connection.

**Known gap**: no CAPTCHA (reCAPTCHA/hCaptcha/Cloudflare Turnstile) —
none of those can be wired up without an account on that service, which
needs to be set up by whoever owns this deployment. The honeypot + rate
limiting are a reasonable baseline without it; add one of those services
on top if spam gets past this.

## Deployment

```bash
docker-compose up --build -d
```

Serves on port 8085 by default (`WEB_HOST_PORT` to override) — chosen
because it was free on the target VPS alongside the `riskyc-chat-backend`
stack; Compose scopes this to its own project, so it can't collide with or
cross-talk to any other stack already running there (same isolation model
as `backend/docker-compose.yml` — see that file's own comment for the
detail on how).

The backend's CORS allow-list (`RISKYC_CORS_ALLOWED_ORIGINS` in
`backend/.env`) needs this origin added before sign-in will work from
wherever this actually ends up served.

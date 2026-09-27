# Security headers and Content Security Policy (Phase 4, security review)

Every public page and every API response now carries defensive headers. This
closes the `PRD.md` security requirement for *"secure headers and a Content
Security Policy appropriate for Google Maps integrations"*.

## Web app (Next.js)

`frontend-part/src/config/security-headers.ts` builds the policy from the build
environment and `next.config.ts` applies it to `/:path*`.

| Directive | Sources | Why |
| --- | --- | --- |
| `default-src` | `'self'` | Everything else is denied by default. |
| `script-src` | `'self'`, `'unsafe-inline'`, Maps script origin, `'unsafe-eval'` outside deployed environments | The App Router inlines its flight payload. `eval` is development-only for React error stacks and is absent in staging and production. |
| `style-src` | `'self'`, `'unsafe-inline'`, Maps script origin | Next.js styles and the WebGL ribbon set inline styles. |
| `img-src` | `'self'`, `data:`, `blob:`, Maps assets, campus embed, configured CDN | Rental photos come from the CDN; map tiles and the campus preview come from Google. |
| `connect-src` | `'self'`, configured API origin, Maps origins | Browser calls the versioned API and Maps services. |
| `worker-src` | `'self'`, `blob:` | The WebGL ribbon and 3D map render in a local worker/canvas. |
| `frame-src` | `maps.google.com`, `www.google.com` | The landing campus map embed. It redirects to `www.google.com`, so both hosts are required. |
| `object-src` | `'none'` | No plugins or embedded objects. |
| `base-uri` | `'self'` | Prevents base-tag rewriting. |
| `form-action` | `'self'` | Forms cannot post off-site. |
| `frame-ancestors` | `'none'` | The site cannot be framed (clickjacking). |

Alongside the policy: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` (so private search context is
not leaked in referrer URLs), and a `Permissions-Policy` that denies geolocation
and every other unused browser capability. `Strict-Transport-Security` is added
in staging and production only.

Malformed `CDN_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` values are dropped rather
than inserted into the policy, so a misconfigured environment cannot inject an
unexpected origin.

The policy is written into the build output, so it is fixed at build time and
cannot be changed by the environment that later runs the application. A build
that declares an unrecognised `APP_ENV` therefore fails instead of silently
shipping the development policy, which would grant `'unsafe-eval'` and omit
HSTS. A build with no `APP_ENV` at all is the documented local `pnpm run build`
and keeps the development policy; deployed builds set `APP_ENV` explicitly in
CI and `deploy-part/docker/frontend.Dockerfile`.

### Known trade-off

`'unsafe-inline'` is retained for scripts and styles. Removing it requires a
per-request nonce, which the Next.js CSP guide notes forces dynamic rendering;
the public landing page is intentionally static. The directives that prevent
framing, plugin content, base-tag rewriting, and off-site form posting do not
depend on this allowance. A future nonce-based `proxy.ts` can tighten
`script-src` if the static-rendering requirement changes.

## API (NestJS)

`backend-part/src/common/http/security-headers.ts` sets the same defensive
headers on every API response, plus a JSON-only policy
(`default-src 'none'; frame-ancestors 'none'; sandbox`). The API never renders a
document, so nothing may load or execute from it. CORS continues to restrict
which browser origins may read authenticated responses.

## Verification

- `frontend-part/tests/security-headers.test.ts` and
  `backend-part/tests/security-headers.test.mjs` cover the policy contents,
  wildcard rejection, malformed-origin handling, environment-dependent HSTS, and
  the deployed-only `eval` relaxation.
- The policy was checked in a real Chromium load of the landing page: the
  response carried the expected headers with zero CSP violations and no page
  errors. That check is what caught the `www.google.com` embed redirect.

# Security review and deployment

Reviewed on 2026-09-05 UTC.
Deployed to https://anime.yukagecho.workers.dev with version `5789f9ba-87ce-43e0-b6ee-619bb1c61a4e`.

## Trust boundary

The browser calls Supabase Auth and the Data API directly using the project's publishable key.
That key is public by design and does not grant administrator privileges.
The browser's user ID, validation messages and residency state are not authorization controls.
Supabase verifies the session JWT, and PostgreSQL checks grants, RLS and constraints on each query.

## Verified controls

- `public.residents` has RLS enabled, with owner-only SELECT and INSERT policies.
- INSERT requires the JWT subject to equal `user_id`, a non-anonymous account and either Google-linked OAuth or legacy email OTP authentication in the signed JWT.
- No authorization decision uses user-editable metadata.
- Anonymous clients cannot read or insert reservations, and authenticated clients cannot read another user's row or insert for another user.
- UPDATE and DELETE privileges are absent, and clients cannot supply `reserved_at`.
- Primary-key and unique constraints enforce one reservation per account and one owner per username.
- CHECK constraints enforce normalized usernames and the reserved-name list.
- The client uses INSERT, never an overwriting upsert, and reconciles uncertain responses by reading its own row.
- Session changes clear resident cards and invalidate stale responses.
- No service-role key or private key was found in the production bundle, and a non-publishable Supabase key fails the build.
- No raw HTML injection or eval call was found in application source.

The production SQL test in `supabase/tests/resident_registration.sql` passed again using actual `authenticated` and `anon` roles.
All synthetic users and reservations were rolled back.
Supabase security advisors returned no findings.
The production dependency audit reported zero known vulnerabilities.
These checks are evidence for the inspected implementation, not a guarantee against every possible attack.

## Browser protections

`public/_headers` adds an enforced Content Security Policy with same-origin scripts, a restricted Supabase connection destination, no plugin objects, no base-URL changes and no third-party framing.
Inline styles remain allowed because the rendering stack writes element styles; inline scripts are not allowed.
The response also includes nosniff, DENY framing, a referrer policy, HSTS and disabled camera/microphone/geolocation permissions.
Production HTTP responses matched the local build and contained these headers.
Requests for `.env.local`, SQL migrations and TypeScript source did not expose those files.

Sessions are persisted in browser storage by Supabase, so preventing script injection remains important.
This implementation does not claim HttpOnly session-cookie isolation.

## Google follow-up review

Google RLS migrations were applied to the production database on 2026-09-05 UTC.
Production rollback tests passed for Google sessions, linked email/Google sessions, namespace constraints, owner-only access, absent update/delete privileges and rejection of forged Google user_metadata.
Google is enabled and the frontend is deployed as `a97b69b1-1a47-4fda-b766-2d96c5a572ae`.
The production button reaches Google account selection, and the exact production return URL is allow-listed.
Live HTML matches the local build; CSP and framing protection remain applied.
All five production registration browser tests passed with mocked Auth and Data API traffic.
See [resident-registration.md](resident-registration.md) for the exact callback and redirect URLs.
A real Google authentication test remains pending; browser tests mock provider traffic.

The latest security advisor reports one warning: leaked password protection is disabled.
This UI does not accept passwords, and password-only sessions cannot insert resident rows.
No database RLS advisor findings were returned.
The warning remains relevant if password sign-in is introduced: [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Username-first registration

Migration `20260905031920_username_availability.sql` exposes an exact-name availability boolean before sign-in.
The endpoint intentionally bypasses resident SELECT RLS only inside a fixed-search-path SQL function with no dynamic SQL.
PUBLIC execute is revoked; anon and authenticated execute are explicitly granted.
The only returned datum is whether a valid normalized name is available.
Table ownership policies and write privileges are unchanged, and the unique constraint remains authoritative after OAuth.

The advisor reports the intentional anonymous and authenticated SECURITY DEFINER execution as warnings.
This reviewed exception is necessary for the requested pre-login availability check and does not grant direct table access.
See [anonymous definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
Existing-name guesses can reveal that a username is unavailable, which is inherent to the requested check; no owner information is exposed.

Production rollback tests passed for availability and the existing ownership, namespace and privilege assertions.
The browser stores only the chosen username and creation time for up to 30 minutes in tab-scoped sessionStorage.
A callback consumes the intent once; stale names, API errors, competing reservations and already-registered accounts are covered by tests.

The username-first frontend is deployed as `30daa3fb-6690-4c6c-8c5e-2e263ded6bdd`.
Production HTML matches the build and the CSP remains present.

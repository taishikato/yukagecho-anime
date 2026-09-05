# Resident registration

Implementation lives on `experiment/ground-to-sky`.
The Supabase production project is `xjplkhzawxmgsglrotsl` (`yukagecho`).
Use this production DB for development and verification; do not start Docker or a local DB.

## Implemented behavior

Check the roofed wooden notice board beside the starting traveler with E or tap 'Read the notice'.
The board is separate from the seven discovery places.
Guests never see a modal automatically, including on `/?join=1`.
Guests choose a username first and submit Sign up and own username.
An exact-name availability RPC blocks taken names before Google OAuth.
The chosen name is stored in sessionStorage for up to 30 minutes.
On a Google return, an unreserved account automatically attempts one INSERT and sees its resident card on success.
The intent is consumed before the attempt so failed or competing reservations do not retry automatically.
A conflict returns to name selection; an existing resident account keeps its original name.
Without a pending intent, an unreserved account sees manual name selection.
Reloading with an unreserved session also opens the claim screen; existing residents return directly to exploration.
Closing the prompt keeps it dismissed for that account during the current page visit.
Guests can keep exploring.

The flow supports Google sign-in, a resumed account without a username, atomic username reservation, a resident card and sign-out.
Names are trimmed and lowercased before confirmation, limited to 3-20 ASCII letters, numbers and underscores.
The reserved list is `admin`, `administrator`, `support`, `system`, `yukagecho`, `moderator`, `staff`, `official`.
Reservations have no automatic expiry and no client update/delete permission.
Account deletion is restricted by the foreign key until an explicit release policy is agreed.

The store subscribes to authentication changes and discards responses for an earlier session.
A failed profile read is an error, never proof that the account has no username.
After a duplicate or lost INSERT response, the client reads its own reservation to recover a committed result.
The modal pauses movement and camera controls, isolates typing, uses a native dialog with explicit Tab focus cycling, closes on Escape and returns focus to the canvas.

## Production database

Migration `20260905013034_resident_registration.sql` was applied through Supabase MCP on 2026-09-05 UTC.
The local migration version matches the production migration history.
The table uses a user primary key, unique username, namespace checks, explicit column INSERT grants and owner-only RLS.
Non-anonymous Google accounts with OAuth authentication in their signed JWT can reserve a name.
Verified legacy email OTP sessions remain supported by the database.
Linked Google identities are recognized using trusted app_metadata.providers.
Reservation RLS does not use user-editable metadata or public directory access.
The deliberately public username_available RPC uses a fixed-search-path SECURITY DEFINER function to return only exact-name availability.
It exposes no user IDs, timestamps, email addresses or row listing; normal table grants and RLS remain unchanged.
Google support is applied in migrations `20260905023541_google_resident_registration.sql` and `20260905023651_linked_google_residents.sql`.

Run `supabase/tests/resident_registration.sql` through the production project's SQL execution tool.
It creates two synthetic Auth rows inside a transaction, switches to the actual `authenticated` and `anon` roles, checks ownership/privileges/namespace/OTP requirements, and rolls back every fixture.
Any failed assertion raises an exception.
The test passed, security advisors returned no findings, and a subsequent query confirmed zero Auth users and zero reservations.
Performance advisors also returned no findings.
An anonymous request to the production Data API returned HTTP 401 / PostgreSQL code `42501`.
This verifies database constraints and roles; it does not substitute for concurrent HTTP requests from two real authenticated clients.

## Google production configuration

Google is enabled as verified through the production Auth settings endpoint on 2026-09-05 UTC.
The Site URL is `https://anime.yukagecho.workers.dev`.
The exact production return URL `https://anime.yukagecho.workers.dev/?signin=google` was added to the redirect allow list and verified saved.
The existing `http://localhost:3000` entry remains.
Google redirects to `https://xjplkhzawxmgsglrotsl.supabase.co/auth/v1/callback`.
The deployed button reaches Google's account chooser successfully.
Real account selection, consent, token exchange and username reservation have not been performed by the agent.
Google's displayed privacy and terms links currently point to `https://multilang-ai.vercel.app/`; update the Google OAuth branding to Yukagecho's intended policies.

Deployed version: `30daa3fb-6690-4c6c-8c5e-2e263ded6bdd`.
The live HTML matches the local build and the security headers are present.
All five registration browser tests passed against the production deployment with mocked Auth and Data API traffic.
The previous build, lint and 16 unit tests also passed.

Google credentials belong only in Supabase provider settings, never Vite variables or the browser bundle.
No additional Google scopes or offline access are requested.
Email SMTP configuration is no longer required for this UI.

The application reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at Vite build time.
Copy `.env.example` to `.env.local` and use the project's enabled `sb_publishable_...` key.
The local ignored `.env.local` has been configured for the production project.
Never provide a secret or service-role key to Vite.
The Vite configuration refuses a supplied key without the `sb_publishable_` prefix before creating a bundle.
Missing configuration leaves exploration available and shows a closed registration desk.
A fresh build is required after environment changes.

## Automated verification

```sh
npm run build
npm run lint
npm test
# Start npm run dev in another terminal.
npm run test:e2e
```

Unit tests cover namespace validation, failed profile recovery, duplicate submission, reservation conflict, response-loss recovery and stale responses after sign-out/account changes.
Registration browser tests intercept Supabase requests, so they never send mail or create production records.
They exercise desktop/mobile Google callbacks, username validation/conflict, card restoration, sign-out, keyboard isolation and the E/tap notice interaction.
Existing browser tests cover guest discovery, saved progress, camera, photo, audio and the full ground-to-sky walking route.

## References

- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase JWT authentication methods](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Verification results

Build, lint and all 15 unit tests passed.
The full six-test browser suite passed after moving the notice away from the foothill discovery point.
After adding explicit Tab focus cycling, all five affected registration and UI browser tests passed again, including resume after authentication but before reservation.
The ground-to-sky round trip passed in the full run; the final focus-only adjustment does not change movement or interaction geometry.

## Google follow-up

The Google UI replaces both email and code entry with one button.
The SDK consumes callback credentials; an unreserved session opens the username screen automatically.
A cancelled callback reopens registration with a retry path.
Browser tests mock the OAuth redirect and do not authenticate with a real Google account.

## Username-first verification

Build, lint and 21 unit tests passed.
Ten registration browser tests cover pre-authentication conflicts, availability errors, automatic reservation, races during OAuth, existing resident accounts and the earlier restoration flows.
Production rollback SQL assertions also check anonymous availability and continued denial of direct resident table access.
The live anonymous RPC returned only booleans for reserved and available candidates.
The security advisor flags the intentionally public SECURITY DEFINER endpoint for anon and authenticated roles; this is a reviewed exception limited to exact-name availability.

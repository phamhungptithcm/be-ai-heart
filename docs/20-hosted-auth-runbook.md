# Hosted Auth Runbook

This runbook turns the current local-first hosted auth lane into a repeatable hosted deployment path for `BeHeart`.

## What This Covers

- Auth0 and Clerk OIDC provider wiring
- Standalone API host URLs and callback URLs
- Portal sign-in expectations
- Local end-to-end smoke against the hosted auth contract

## Required Hosted Base URLs

Set these in the hosted environment and in the customer-facing apps:

- `BE_AI_HEART_API_BASE_URL`
- `BE_AI_HEART_WEBSITE_BASE_URL`
- `BE_AI_HEART_PORTAL_BASE_URL`
- `BE_AI_HEART_ADMIN_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL`

Example values live in [/.env.hosted.example](/Users/hunpeo97/Desktop/Workspace/Coder/be-ai-heart/.env.hosted.example).

## Auth0 Hosted Setup

Provider env:

- `BE_AI_HEART_AUTH0_ISSUER`
- `BE_AI_HEART_AUTH0_CLIENT_ID`
- `BE_AI_HEART_AUTH0_CLIENT_SECRET`
- `BE_AI_HEART_AUTH0_AUDIENCE`

Recommended callback URL:

- `https://api.beheart.dev/auth/callback/auth0`

Recommended application login start:

- `https://api.beheart.dev/auth/authorize/auth0?surface=portal&return_to=https%3A%2F%2Fportal.beheart.dev%2Fauth%2Fcomplete`

## Clerk Hosted Setup

Provider env:

- `BE_AI_HEART_CLERK_OIDC_ISSUER`
- `BE_AI_HEART_CLERK_CLIENT_ID`
- `BE_AI_HEART_CLERK_CLIENT_SECRET`
- `BE_AI_HEART_CLERK_AUDIENCE`

Recommended callback URL:

- `https://api.beheart.dev/auth/callback/clerk`

Recommended application login start:

- `https://api.beheart.dev/auth/authorize/clerk?surface=portal&return_to=https%3A%2F%2Fportal.beheart.dev%2Fauth%2Fcomplete`

## Portal Sign-In Contract

Portal sign-in does not exchange tokens inside the Next app.

Flow:

1. Portal loads `/api/auth/providers` from the standalone BeHeart API host.
2. User selects Auth0 or Clerk.
3. Browser navigates to `/auth/authorize/:provider` on the API host.
4. Provider redirects back to `/auth/callback/:provider` on the API host.
5. API host issues a scoped `BeHeart` session token.
6. API host redirects back to portal `/auth/complete?...session_token=...`.
7. Portal stores the session token and continues with tenant-scoped reads.

This keeps website and portal free from provider secret handling.

## Local Verification

Local smoke script:

```bash
npm run smoke:auth
```

What it validates:

- provider registry discovery
- provider authorize redirect
- provider callback redirect
- session issuance from the standalone API host
- session resolution for both `auth0` and `clerk`

The smoke uses the local mock OIDC provider. It does not require real vendor credentials.

## Important Limitation

Real Auth0 or Clerk login cannot be validated until the hosted environment contains real issuer, client id, and client secret values.

At the moment the codebase is ready for hosted auth wiring, but production credentials still need to be injected outside the repository.

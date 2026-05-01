# Environment And Secret Contract

## Purpose

This document defines the minimum repository variables, environment variables, and secrets required for the current GitHub Actions setup.

The repository now uses two CI/CD layers:

- `staging` and `main` pull requests run the `Pre-Merge Gates` workflow
- `main` pushes or manual dispatch trigger release and deployment workflows

For one-time platform bootstrap steps in GitHub, Firebase, and Google Cloud, use [GitHub Ops Bootstrap](./21-github-ops-bootstrap.md).

## GitHub Environments

Recommended environments:

- `production`
- `github-pages`

Use environment protection rules for `production` before enabling the release workflows.

## Branch Model

- feature and dev branches merge into `staging`
- `staging` is the only branch allowed to merge into `main`
- release and deploy automation only runs from `main`

## Pre-Merge Gates

Current gate coverage:

- `npm run build`
- `npm run test`
- `npm run e2e`

Current `e2e` implementation is the hosted-auth smoke path:

- `npm run smoke:auth`

This is intentionally lightweight until the repo has a broader browser-level E2E suite.

## Global Repository Variables

Store these as repository variables unless your policy requires environment-level scope.

| Name | Example | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `beheart-df3dd` | Firebase project used by App Hosting workflows |
| `FIREBASE_BACKEND_WEBSITE` | `beheart-website` | Website App Hosting backend id |
| `FIREBASE_BACKEND_PORTAL` | `beheart-portal` | Portal App Hosting backend id |
| `FIREBASE_BACKEND_ADMIN` | `beheart-admin` | Admin App Hosting backend id |
| `GCP_PROJECT_ID` | `your-gcp-project-id` | Google Cloud project used by Cloud Run |
| `GCP_REGION` | `us-central1` | Google Cloud deploy region |
| `ARTIFACT_REGISTRY_REPOSITORY` | `beheart` | Artifact Registry repository name |
| `CLOUD_RUN_SERVICE_API` | `beheart-api` | Cloud Run service name for `services/api` |

## GitHub Secrets

Store these in the `production` environment unless you have a reason to scope them more broadly.

| Name | Purpose |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider resource for GitHub Actions |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account email used by release workflows |

## npm Publishing

Preferred setup:

- configure npm trusted publishing for the CLI package
- keep `Release CLI` as manual-only until `packages/cli` is bundle-safe and publishable

Current repo status:

- `packages/cli` still imports internal workspaces and service code through relative paths
- do not enable automatic CLI publishing on `main` until package boundaries are cleaned up

## App Hosting Runtime Configuration

Each Next.js surface now includes a minimal `apphosting.yaml`:

- `apps/website/apphosting.yaml`
- `apps/portal/apphosting.yaml`
- `apps/admin/apphosting.yaml`

Before the first production rollout, configure backend-specific environment variables for:

### Website

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL`

Optional public client config if the website starts using Firebase SDK browser setup:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Portal

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION`

Optional public client config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Admin

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION`

Optional public client config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## Firebase Public Client Config

The user-provided Firebase web config values are public client identifiers, not server secrets. Keep them out of logs, but they do not need secret storage by default.

### Website app ids

- project id: `beheart-df3dd`
- app id: `1:590161710274:web:e613190535338294ea3f5b`
- measurement id: `G-YC234Q6MBB`

### Portal app ids

- project id: `beheart-df3dd`
- app id: `1:590161710274:web:ac5fb8c2c1d18bd8ea3f5b`
- measurement id: `G-7EVXEBT9DD`

### Admin app ids

- project id: `beheart-df3dd`
- app id: `1:590161710274:web:f8b9d08b8ecab741ea3f5b`
- measurement id: `G-Q61MXQ6NH0`

## Cloud Run Release Requirements

The API release workflow expects:

- `services/api/Dockerfile`
- Artifact Registry repository already created
- Cloud Run service name supplied via `CLOUD_RUN_SERVICE_API`

The Dockerfile sets:

- `PORT=8080`
- `BE_AI_HEART_API_HOST=0.0.0.0`

This is required because the API host defaults to loopback in local development.

## GitHub Pages

The docs release workflow publishes a generated static artifact to GitHub Pages.

Required repository setup:

- GitHub Pages enabled
- source set to GitHub Actions

## Security Rules

- never commit long-lived credentials
- prefer OIDC and short-lived cloud auth
- keep release permissions minimal per workflow
- treat admin and cloud deployment changes as security-sensitive

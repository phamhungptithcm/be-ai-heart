# GitHub Ops Bootstrap

## Purpose

This runbook covers the one-time platform setup that cannot be fully automated from the local repository:

- GitHub environments
- GitHub repository variables and secrets
- branch protection
- GitHub Pages enablement
- Firebase App Hosting backend setup
- Google Cloud Artifact Registry, Workload Identity Federation, and Cloud Run prerequisites
- npm trusted publishing readiness

Use this document before enabling the `main` release workflows.

If you want a shell helper for the repeatable parts, use:

- `scripts/bootstrap-github-gcp.sh`
- `.env.bootstrap.example`

Recommended first pass:

```bash
cp .env.bootstrap.example .env.bootstrap.local
${EDITOR:-vi} .env.bootstrap.local
set -a
source ./.env.bootstrap.local
set +a
./scripts/bootstrap-github-gcp.sh
```

Then rerun without `DRY_RUN=1` once the values look correct.

## Bootstrap Order

1. Create GitHub environments
2. Add repository variables and production secrets
3. Enable GitHub Pages
4. Configure branch protection for `staging` and `main`
5. Create Firebase App Hosting backends
6. Create Google Cloud Artifact Registry and service account permissions
7. Configure GitHub OIDC to Google Cloud
8. Confirm Cloud Run target naming
9. Leave CLI publishing manual until the package is standalone-safe

## GitHub Environments

Create these environments:

- `production`
- `github-pages`

Recommended `production` protection:

- required reviewers enabled
- deployment branch policy limited to `main`
- wait timer only if your release process needs a timed hold

Recommended `github-pages` protection:

- leave lightweight unless you need manual approval for docs publishing

## Repository Variables

Add these repository variables:

| Name | Example |
|---|---|
| `FIREBASE_PROJECT_ID` | `beheart-df3dd` |
| `FIREBASE_BACKEND_WEBSITE` | `beheart-website` |
| `FIREBASE_BACKEND_PORTAL` | `beheart-portal` |
| `FIREBASE_BACKEND_ADMIN` | `beheart-admin` |
| `GCP_PROJECT_ID` | `your-gcp-project-id` |
| `GCP_REGION` | `us-central1` |
| `ARTIFACT_REGISTRY_REPOSITORY` | `beheart` |
| `CLOUD_RUN_SERVICE_API` | `beheart-api` |

Keep these values stable once workflows are active.

## Production Secrets

Add these secrets to the `production` environment:

| Name | Purpose |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider resource |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account used by GitHub Actions |

Do not add long-lived Google Cloud JSON keys unless you are blocked from using OIDC.

## GitHub Pages

In GitHub repository settings:

1. Open `Settings -> Pages`
2. Set source to `GitHub Actions`
3. Save

The docs workflow publishes the generated static bundle and does not require a dedicated Pages branch.

## Branch Protection

### `staging`

Recommended rules:

- require a pull request before merging
- require status checks before merging
- required check: `Pre-Merge Gates / validate`
- disallow force pushes
- disallow deletions

### `main`

Recommended rules:

- require a pull request before merging
- require status checks before merging
- required check: `Pre-Merge Gates / validate`
- require branch to be up to date before merging
- disallow force pushes
- disallow deletions
- restrict who can push directly

Recommended policy:

- only `staging` may merge into `main`

This last rule is enforced partly by workflow logic and should also be enforced by team practice or branch rules.

## Firebase App Hosting Backends

Create three distinct App Hosting backends in the Firebase project:

- `website`
- `portal`
- `admin`

Use the Firebase CLI or Firebase console. For CLI creation, run from the repo root:

```bash
firebase apphosting:backends:create --project PROJECT_ID
```

During the prompt flow:

- choose the GitHub repository for this monorepo
- set the root directory to:
  - `apps/website`
  - `apps/portal`
  - `apps/admin`
- set the live branch to `main`
- assign the backend id that matches the GitHub variable you intend to use

Recommended backend ids:

- `beheart-website`
- `beheart-portal`
- `beheart-admin`

Important:

- if you want GitHub Actions to be the only release trigger, disable automatic rollouts in App Hosting after backend creation
- if you keep automatic rollouts enabled, pushes to `main` may trigger both App Hosting rollouts and GitHub Action rollouts

## App Hosting Runtime Variables

After each backend exists, configure its runtime variables so the Next.js surface has the correct public URLs.

### Website backend

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL`

### Portal backend

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION`

### Admin backend

- `NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL`
- `NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION`

Only add Firebase browser config vars if the surface actually starts using the Firebase client SDK.

## Google Cloud Artifact Registry

Create the Docker repository used by the API release workflow:

```bash
gcloud artifacts repositories create REPOSITORY_NAME \
  --repository-format=docker \
  --location=REGION \
  --description="be-ai-heart container images"
```

Recommended defaults:

- `REPOSITORY_NAME=beheart`
- `REGION=us-central1`

## Google Cloud Service Account

Create a dedicated deploy service account:

```bash
gcloud iam service-accounts create be-ai-heart-github \
  --display-name="BeHeart GitHub Actions"
```

Grant only the roles needed by the current workflows.

Minimum practical roles for the release setup:

- Artifact Registry writer
- Cloud Run admin
- Service Account User on the runtime service account

If the same identity is also used for Firebase App Hosting rollout commands, verify any additional Firebase or project-level permissions needed during rollout in your project before production cutover.

## Workload Identity Federation

Create a workload identity pool and provider for GitHub Actions, then allow the GitHub repository to impersonate the deploy service account.

High-level flow:

1. create workload identity pool
2. create OIDC provider for `token.actions.githubusercontent.com`
3. bind `roles/iam.workloadIdentityUser` on the deploy service account to the GitHub principal set for this repository

Example commands:

```bash
gcloud iam workload-identity-pools create github-pool \
  --project=PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"
```

```bash
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
```

Then bind the service account to the repository principal set for your repo.

Store these two values in GitHub after setup:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

## Cloud Run Naming

Finalize the API service name before first deploy:

- recommended: `beheart-api`

Make sure the release workflow variable `CLOUD_RUN_SERVICE_API` matches the intended service.

## npm Trusted Publishing

Do not enable automated CLI publishing yet unless all of the following are true:

- `packages/cli` no longer depends on unpublished runtime-relative workspace imports
- package contents are deterministic
- `npm pack --dry-run` looks correct
- a trusted publisher is configured on npm for the exact repository and workflow

When ready:

1. open npm package settings
2. configure a trusted publisher for this GitHub repository and workflow file
3. keep `id-token: write` in the publish workflow

Until then, `Release CLI` should remain manual-only or disabled.

## Final Readiness Check

Before enabling production deploys from `main`, verify:

- `Pre-Merge Gates` is required on both `staging` and `main`
- `production` and `github-pages` environments exist
- GitHub Pages source is `GitHub Actions`
- App Hosting backends exist and are pointed at the monorepo paths
- App Hosting automatic rollout behavior is explicitly chosen
- Artifact Registry exists
- OIDC variables and secrets are populated
- Cloud Run service name is finalized
- docs and release runbooks are reviewed by whoever owns infra

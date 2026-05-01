#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Bootstrap GitHub + GCP + release prerequisites for be-ai-heart.

Required environment variables:
  OWNER
  REPO
  PROJECT_ID

Optional environment variables:
  PROJECT_NUMBER                Computed automatically if omitted
  REGION                        Default: us-central1
  FIREBASE_PROJECT_ID           Default: beheart-df3dd
  FIREBASE_BACKEND_WEBSITE      Default: beheart-website
  FIREBASE_BACKEND_PORTAL       Default: beheart-portal
  FIREBASE_BACKEND_ADMIN        Default: beheart-admin
  ARTIFACT_REGISTRY_REPOSITORY  Default: beheart
  CLOUD_RUN_SERVICE_API         Default: beheart-api
  SERVICE_ACCOUNT_ID            Default: be-ai-heart-github
  WIF_POOL_ID                   Default: github-pool
  WIF_PROVIDER_ID               Default: github-provider
  DRY_RUN                       Default: 0
  CREATE_FIREBASE_BACKENDS      Default: 0

Example:
  OWNER=my-org \
  REPO=be-ai-heart \
  PROJECT_ID=my-prod-project \
  DRY_RUN=1 \
  ./scripts/bootstrap-github-gcp.sh
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

OWNER="${OWNER:?Set OWNER to your GitHub org or username}"
REPO="${REPO:?Set REPO to the repository name}"
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID to the Google Cloud project id}"
REGION="${REGION:-us-central1}"
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-beheart-df3dd}"
FIREBASE_BACKEND_WEBSITE="${FIREBASE_BACKEND_WEBSITE:-beheart-website}"
FIREBASE_BACKEND_PORTAL="${FIREBASE_BACKEND_PORTAL:-beheart-portal}"
FIREBASE_BACKEND_ADMIN="${FIREBASE_BACKEND_ADMIN:-beheart-admin}"
ARTIFACT_REGISTRY_REPOSITORY="${ARTIFACT_REGISTRY_REPOSITORY:-beheart}"
CLOUD_RUN_SERVICE_API="${CLOUD_RUN_SERVICE_API:-beheart-api}"
SERVICE_ACCOUNT_ID="${SERVICE_ACCOUNT_ID:-be-ai-heart-github}"
WIF_POOL_ID="${WIF_POOL_ID:-github-pool}"
WIF_PROVIDER_ID="${WIF_PROVIDER_ID:-github-provider}"
DRY_RUN="${DRY_RUN:-0}"
CREATE_FIREBASE_BACKENDS="${CREATE_FIREBASE_BACKENDS:-0}"

if [[ -z "${PROJECT_NUMBER:-}" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
fi

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

maybe_run() {
  printf '+'
  printf ' %q' "$@"
  printf '\n'

  if [[ "$DRY_RUN" != "1" ]]; then
    "$@"
  fi
}

gh_api_json() {
  local method="$1"
  local path="$2"
  local json="$3"

  printf '+ gh api --method %q %q --input -\n' "$method" "$path"
  if [[ "$DRY_RUN" != "1" ]]; then
    gh api \
      --method "$method" \
      -H "Accept: application/vnd.github+json" \
      "$path" \
      --input - <<<"$json" >/dev/null
  fi
}

create_environment() {
  local name="$1"
  gh_api_json "PUT" "/repos/${OWNER}/${REPO}/environments/${name}" '{}'
}

set_repo_variable() {
  local name="$1"
  local value="$2"
  maybe_run gh variable set "$name" --body "$value" -R "${OWNER}/${REPO}"
}

set_environment_secret() {
  local name="$1"
  local value="$2"
  maybe_run gh secret set "$name" --env production --body "$value" -R "${OWNER}/${REPO}"
}

protect_branch() {
  local branch="$1"
  local payload
  payload="$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
)"
  gh_api_json "PUT" "/repos/${OWNER}/${REPO}/branches/${branch}/protection" "$payload"
}

ensure_service_enabled() {
  maybe_run gcloud services enable "$@" --project "$PROJECT_ID"
}

ensure_artifact_registry_repo() {
  if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPOSITORY" \
    --location="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Artifact Registry repository already exists: ${ARTIFACT_REGISTRY_REPOSITORY}"
    return
  fi

  maybe_run gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="be-ai-heart container images" \
    --project="$PROJECT_ID"
}

ensure_service_account() {
  if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Service account already exists: ${SERVICE_ACCOUNT_EMAIL}"
    return
  fi

  maybe_run gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
    --display-name="BeHeart GitHub Actions" \
    --project "$PROJECT_ID"
}

ensure_wif_pool() {
  if gcloud iam workload-identity-pools describe "$WIF_POOL_ID" \
    --project="$PROJECT_ID" \
    --location="global" >/dev/null 2>&1; then
    echo "Workload identity pool already exists: ${WIF_POOL_ID}"
    return
  fi

  maybe_run gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool"
}

ensure_wif_provider() {
  if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL_ID" >/dev/null 2>&1; then
    echo "Workload identity provider already exists: ${WIF_PROVIDER_ID}"
    return
  fi

  maybe_run gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL_ID" \
    --display-name="GitHub Actions Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${OWNER}/${REPO}'"
}

grant_project_role() {
  local role="$1"
  maybe_run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="$role"
}

grant_wif_access() {
  maybe_run gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository/${OWNER}/${REPO}"
}

print_manual_next_steps() {
  cat <<EOF

Manual follow-up still required:

1. GitHub UI
   - Settings -> Pages -> Source = GitHub Actions
   - Branch rules: block direct push to staging and main if needed
   - Environment protection: add reviewers / branch restrictions for production

2. Firebase App Hosting
   - Create three backends if not already present:
       firebase apphosting:backends:create --project "$FIREBASE_PROJECT_ID" --location "$REGION"
   - Use these root directories and backend ids:
       apps/website -> $FIREBASE_BACKEND_WEBSITE
       apps/portal  -> $FIREBASE_BACKEND_PORTAL
       apps/admin   -> $FIREBASE_BACKEND_ADMIN
   - Live branch should be main
   - Disable automatic rollouts if GitHub Actions should be the only release path

3. App Hosting runtime variables
   Website:
     NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL
   Portal:
     NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION
   Admin:
     NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL
     NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION

4. CLI publishing
   - Keep Release CLI manual-only until packages/cli is standalone-safe

Stored values:
   GCP service account:      $SERVICE_ACCOUNT_EMAIL
   WIF provider resource:    $WIF_PROVIDER_RESOURCE
EOF
}

require_cmd gh
require_cmd gcloud

if [[ "$CREATE_FIREBASE_BACKENDS" == "1" ]]; then
  require_cmd firebase
fi

echo "Bootstrapping GitHub repository settings for ${OWNER}/${REPO}"
maybe_run gh auth status
create_environment "production"
create_environment "github-pages"

set_repo_variable "FIREBASE_PROJECT_ID" "$FIREBASE_PROJECT_ID"
set_repo_variable "FIREBASE_BACKEND_WEBSITE" "$FIREBASE_BACKEND_WEBSITE"
set_repo_variable "FIREBASE_BACKEND_PORTAL" "$FIREBASE_BACKEND_PORTAL"
set_repo_variable "FIREBASE_BACKEND_ADMIN" "$FIREBASE_BACKEND_ADMIN"
set_repo_variable "GCP_PROJECT_ID" "$PROJECT_ID"
set_repo_variable "GCP_REGION" "$REGION"
set_repo_variable "ARTIFACT_REGISTRY_REPOSITORY" "$ARTIFACT_REGISTRY_REPOSITORY"
set_repo_variable "CLOUD_RUN_SERVICE_API" "$CLOUD_RUN_SERVICE_API"

echo "Applying branch protection"
protect_branch "staging"
protect_branch "main"

echo "Configuring Google Cloud services"
ensure_service_enabled \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com

ensure_artifact_registry_repo
ensure_service_account
grant_project_role "roles/run.admin"
grant_project_role "roles/artifactregistry.writer"
grant_project_role "roles/iam.serviceAccountUser"

ensure_wif_pool
ensure_wif_provider
grant_wif_access

set_environment_secret "GCP_WORKLOAD_IDENTITY_PROVIDER" "$WIF_PROVIDER_RESOURCE"
set_environment_secret "GCP_SERVICE_ACCOUNT_EMAIL" "$SERVICE_ACCOUNT_EMAIL"

if [[ "$CREATE_FIREBASE_BACKENDS" == "1" ]]; then
  echo "Launching interactive Firebase backend creation. Follow prompts carefully."
  maybe_run firebase apphosting:backends:create --project "$FIREBASE_PROJECT_ID" --location "$REGION"
  maybe_run firebase apphosting:backends:create --project "$FIREBASE_PROJECT_ID" --location "$REGION"
  maybe_run firebase apphosting:backends:create --project "$FIREBASE_PROJECT_ID" --location "$REGION"
fi

print_manual_next_steps

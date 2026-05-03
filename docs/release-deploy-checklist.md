# Release And Deploy Checklist

## Purpose

This checklist defines the minimum safe release path for the current `be-ai-heart` monorepo.

The repository now separates:

- pre-merge validation for `staging` and `main`
- release and deployment from `main` only

For one-time setup outside the repo, use [GitHub Ops Bootstrap](./21-github-ops-bootstrap.md).

## Branch Promotion Rules

Expected path:

1. feature or dev branch opens a pull request into `staging`
2. `Pre-Merge Gates` passes on the `staging` pull request
3. `staging` opens a pull request into `main`
4. `Pre-Merge Gates` passes again on the `main` pull request
5. after merge into `main`, release workflows may publish or deploy

`main` should not accept direct feature branch merges.

## Pre-Merge Gate

Workflow:

- `.github/workflows/pre-merge-gates.yml`

Current gate coverage:

- branch promotion policy for `main`
- `npm ci`
- `npm run build`
- `npm run test`
- `npm run e2e`
- website, portal, and admin Next.js builds

Current `e2e` coverage is intentionally narrow:

- hosted-auth smoke
- CLI command and JSON contract smoke
- tracked release artifact safety audit

Browser-level smoke is available through `npm run smoke:web` once local or preview servers are running and `playwright`
is installed with `npm install --no-save playwright@1.51.1`.

## Main-Only Release Workflows

### Docs

- workflow: `.github/workflows/release-docs.yml`
- trigger: `main` push or manual dispatch
- target: GitHub Pages

### Website

- workflow: `.github/workflows/release-website.yml`
- trigger: `main` push or manual dispatch
- target: Firebase App Hosting backend for `website`

### Portal

- workflow: `.github/workflows/release-portal.yml`
- trigger: `main` push or manual dispatch
- target: Firebase App Hosting backend for `portal`

### Admin

- workflow: `.github/workflows/release-admin.yml`
- trigger: `main` push or manual dispatch
- target: Firebase App Hosting backend for `admin`

### API

- workflow: `.github/workflows/release-api.yml`
- trigger: `main` push or manual dispatch
- target: Cloud Run deployment for `services/api`

### CLI

- workflow: `.github/workflows/release-cli.yml`
- trigger: manual dispatch only
- current state: blocked until CLI packaging is cleaned up

## Release Gates

A production release is eligible only when:

- `Pre-Merge Gates` passed on the pull request into `main`
- required production secrets and variables are configured
- API production config starts with `BE_AI_HEART_RUNTIME_ENV=production`
- tracked `.heart/benchmarks` artifacts pass `npm run audit:artifacts`
- CLI command smoke passes through `npm run smoke:cli`
- App Hosting backends already exist and are connected to the repository
- Artifact Registry and Cloud Run are provisioned
- web surfaces build with production `NEXT_PUBLIC_BE_AI_HEART_*` URLs
- there are no known security blockers in the changed deployment path

## Required Platform Setup

Before enabling production workflows, confirm:

- GitHub Pages is enabled and set to GitHub Actions
- `production` and `github-pages` environments exist
- Workload Identity Federation is configured for GitHub Actions
- Firebase App Hosting backends exist for `website`, `portal`, and `admin`
- Artifact Registry repository exists
- Cloud Run service naming and region are finalized
- branch protection is enabled for `staging` and `main`

## Verification Checklist

After a `main` release, verify:

- docs index and key pages render on GitHub Pages
- website loads and uses the correct public URLs
- portal sign-in and main dashboard routes load
- admin sign-in and main dashboard routes load
- API root or health path responds from Cloud Run
- API responses include `X-Be-AI-Heart-Trace-Id`
- `/metrics` responds without sensitive labels
- LLM proxy rejects missing `X-Be-AI-Heart-Proxy-Token` when enabled
- billing surfaces show `paid_public_release_ready=false` unless live billing is configured
- no deploy logs leaked credentials or sensitive content

## Rollback Notes

### Docs

- redeploy the previous GitHub Pages artifact or revert the triggering commit

### Website, Portal, Admin

- restore the prior App Hosting rollout from Firebase

### API

- move Cloud Run traffic back to the previous revision

### CLI

- patch forward or deprecate the bad npm release
- never overwrite a published npm version

## Current Deferred Items

- automatic CLI release from `main`
- worker deployment from `services/worker`
- always-on browser-level E2E coverage in pre-merge CI

These are intentionally deferred to keep the first release system narrow, testable, and aligned with the current repo architecture.

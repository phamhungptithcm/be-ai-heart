---
name: google-cloud-platform
description: Use when be-ai-heart work targets Google Cloud. Trigger on Cloud Run, GKE, Cloud SQL, GCS, Artifact Registry, Secret Manager, IAM, load balancing, VPC, or GCP deployment architecture.
---

# Google Cloud Platform

## Default Recommendation

For early hosted environments, prefer the simplest secure path:

- Cloud Run for stateless services
- Cloud SQL for relational storage
- GCS for reports and artifacts
- Secret Manager for secrets
- IAM with least privilege

## Workflow

1. Map each service to a concrete operational need.
2. Choose managed services before self-managed infrastructure.
3. Design IAM first, then deployment flow.
4. Keep staging and production separated clearly.

## Guardrails

- no broad service account permissions
- prefer workload identity and OIDC-compatible flows
- do not introduce GKE unless Cloud Run no longer fits
- document data residency, retention, and secret boundaries

## Deliverables

- GCP architecture choice
- IAM and secret approach
- deployment assumptions and risks

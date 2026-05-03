import { METRIC_SOURCE_TYPES } from "../../../packages/shared-schema/src/enterprise.js";
import { listConfiguredAuthProviders } from "./provider-config.js";
import { liveBillingRequired } from "./runtime-config.js";

export function resolveAuthProviderAdapter({
  apiBaseUrl,
  surface = "portal",
  returnTo,
} = {}) {
  const configured = listConfiguredAuthProviders({
    apiBaseUrl,
    surface,
    returnTo,
  }).providers;

  return {
    adapter_id: configured.length > 0 ? "hosted_oidc" : "mock",
    provider_mode: configured.length > 0 ? "configured" : "mock",
    source_type: METRIC_SOURCE_TYPES.externalIntegration,
    providers: configured.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      enabled: provider.enabled,
      authorize_url: provider.authorize_url,
      return_to: provider.return_to,
      provider_config: {
        ...provider.provider_config,
      },
    })),
  };
}

export function resolveBillingProviderAdapter() {
  const stripeConfigured = Boolean(
    String(
      process.env.BE_AI_HEART_STRIPE_SECRET_KEY ??
        process.env.STRIPE_SECRET_KEY ??
      "",
    ).trim(),
  );
  const liveRequired = liveBillingRequired(process.env);
  const providerMode = stripeConfigured
    ? "configured"
    : liveRequired
      ? "misconfigured"
      : "mock";

  return {
    adapter_id: stripeConfigured ? "stripe" : "mock",
    provider_mode: providerMode,
    source_type: METRIC_SOURCE_TYPES.externalIntegration,
    integration_label: stripeConfigured ? "Stripe" : "Mock billing",
    live_billing_required: liveRequired,
    paid_public_release_ready: stripeConfigured,
    release_gate: stripeConfigured
      ? "live_billing_configured"
      : liveRequired
        ? "missing_stripe_secret"
        : "paid_release_disabled",
    next_required_action: stripeConfigured
      ? "Verify webhook signing, idempotency, and entitlement sync before paid launch."
      : liveRequired
        ? "Configure BE_AI_HEART_STRIPE_SECRET_KEY or disable live billing mode."
        : "Keep paid checkout disabled for free alpha or private beta.",
  };
}

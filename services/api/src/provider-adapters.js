import { METRIC_SOURCE_TYPES } from "../../../packages/shared-schema/src/enterprise.js";
import { listConfiguredAuthProviders } from "./provider-config.js";

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

  return {
    adapter_id: stripeConfigured ? "stripe" : "mock",
    provider_mode: stripeConfigured ? "configured" : "mock",
    source_type: METRIC_SOURCE_TYPES.externalIntegration,
    integration_label: stripeConfigured ? "Stripe" : "Mock billing",
  };
}


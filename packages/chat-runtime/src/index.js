import { randomUUID } from "node:crypto";

import { sendModelRequest, streamModelResponse } from "../../ai-gateway/src/index.js";
import {
  CONTEXT_ATTACHMENT_TYPES,
  createChatMessage,
  createChatSession as createContractChatSession,
  createContextAttachment,
  createCitation,
} from "../../portal-chat-contracts/src/index.js";

export function createChatSession(options = {}) {
  return createContractChatSession({
    sessionId: options.sessionId ?? `chat-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    ...options,
  });
}

export function buildContextAttachment(type, options = {}) {
  return createContextAttachment({
    attachmentId: options.attachmentId ?? `${type}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    type,
    label: options.label ?? type,
    summary: options.summary ?? "",
    sourceRef: options.sourceRef ?? "",
    citations: options.citations ?? [],
    tokenEstimate: options.tokenEstimate ?? estimateTokens(options.summary),
    data: options.data ?? {},
  });
}

export function attachContextPack(pack = {}) {
  return buildContextAttachment(CONTEXT_ATTACHMENT_TYPES.contextPack, {
    label: pack.task ?? pack.pack_id ?? "Context pack",
    summary: pack.summary ?? pack.task ?? "",
    sourceRef: pack.pack_id ?? "",
    citations: pack.citations ?? [],
    tokenEstimate: pack.estimated_tokens ?? pack.token_estimate ?? 0,
    data: pack,
  });
}

export function attachDomainPack(pack = {}) {
  return buildContextAttachment(CONTEXT_ATTACHMENT_TYPES.domainPack, {
    label: pack.name ?? pack.pack_id ?? "Domain pack",
    summary: pack.summary ?? pack.description ?? "",
    sourceRef: pack.pack_id ?? pack.id ?? "",
    citations: pack.citations ?? [],
    data: pack,
  });
}

export function attachRepoGraph(graph = {}) {
  return buildContextAttachment(CONTEXT_ATTACHMENT_TYPES.repoGraph, {
    label: graph.repo ?? "Repo graph",
    summary: graph.summary ?? `${graph.node_count ?? 0} nodes, ${graph.edge_count ?? 0} edges`,
    sourceRef: graph.profile_slug ?? graph.repo ?? "",
    data: graph,
  });
}

export function attachDocs(docs = []) {
  const documents = Array.isArray(docs) ? docs : docs.documents ?? [];
  return buildContextAttachment(CONTEXT_ATTACHMENT_TYPES.docs, {
    label: "Docs/specs",
    summary: documents.slice(0, 8).map((doc) => doc.title ?? doc.path ?? "").filter(Boolean).join("; "),
    sourceRef: "document_memory",
    citations: documents.slice(0, 12).map((doc) => createCitation({
      type: "document",
      label: doc.title ?? doc.path ?? "Document",
      ref: doc.path ?? doc.ref ?? "",
    })),
    data: { documents: documents.slice(0, 20) },
  });
}

export function attachDocsSpec(docs = []) {
  return attachDocs(docs);
}

export async function sendChatMessage({
  session,
  message,
  providerId,
  modelId,
  credential,
  contextAttachments = [],
  fetchImpl,
  env = process.env,
  maxOutputTokens = 2000,
  native = false,
} = {}) {
  const userMessage = createChatMessage({
    messageId: `msg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    role: "user",
    content: message,
  });
  const baseMessages = [...(session?.messages ?? []), userMessage].map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const response = await sendModelRequest({
    providerId,
    modelId,
    credential,
    fetchImpl,
    env,
    maxOutputTokens,
    system: buildSystemPrompt({ contextAttachments }),
    messages: baseMessages,
  });
  const assistantMessage = createChatMessage({
    messageId: `msg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    role: "assistant",
    content: response.output_text,
    metadata: {
      usage: response.usage,
      cost: response.cost,
      citations: buildAttachmentCitations(contextAttachments),
      artifact_cards: buildAttachmentArtifactCards(contextAttachments),
    },
  });
  return {
    session: session
      ? {
          ...session,
          provider_id: providerId,
          model_id: modelId,
          updated_at: new Date().toISOString(),
          context_attachments: contextAttachments,
          messages: [...(session.messages ?? []), userMessage, assistantMessage],
        }
      : null,
    user_message: userMessage,
    assistant_message: assistantMessage,
    response,
  };
}

export async function* streamChatResponse(options = {}) {
  yield* streamModelResponse({
    ...options,
    system: buildSystemPrompt({ contextAttachments: options.contextAttachments ?? [] }),
  });
}

export async function* streamChatMessage({
  session,
  message,
  providerId,
  modelId,
  credential,
  contextAttachments = [],
  fetchImpl,
  env = process.env,
  maxOutputTokens = 2000,
  native = true,
} = {}) {
  const userMessage = createChatMessage({
    messageId: `msg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    role: "user",
    content: message,
  });
  const baseMessages = [...(session?.messages ?? []), userMessage].map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  let outputText = "";
  let usage = null;
  let cost = null;
  let response = null;

  for await (const event of streamChatResponse({
    providerId,
    modelId,
    credential,
    fetchImpl,
    env,
    maxOutputTokens,
    contextAttachments,
    messages: baseMessages,
    native,
  })) {
    if (event.event === "assistant_delta") {
      outputText += event.delta ?? "";
      yield event;
      continue;
    }
    if (event.event === "usage") {
      usage = event.usage ?? usage;
      cost = event.cost ?? cost;
      yield event;
      continue;
    }
    if (event.event === "run_completed") {
      response = event.response ?? {
        output_text: outputText,
        usage,
        cost,
      };
      usage = response.usage ?? usage;
      cost = response.cost ?? cost;
      const assistantMessage = createChatMessage({
        messageId: `msg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        role: "assistant",
        content: response.output_text ?? outputText,
        metadata: {
          usage,
          cost,
          citations: buildAttachmentCitations(contextAttachments),
          artifact_cards: buildAttachmentArtifactCards(contextAttachments),
        },
      });
      const nextSession = session
        ? {
            ...session,
            provider_id: providerId,
            model_id: modelId,
            updated_at: new Date().toISOString(),
            context_attachments: contextAttachments,
            messages: [...(session.messages ?? []), userMessage, assistantMessage],
          }
        : null;
      yield {
        ...event,
        session: nextSession,
        user_message: userMessage,
        assistant_message: assistantMessage,
        context_attachments: contextAttachments,
        usage,
        cost,
      };
      continue;
    }
    yield event;
  }
}

export function estimateChatCost({ usage, pricing } = {}) {
  if (!pricing) {
    return {
      currency: "USD",
      estimated_total: null,
      source: "unavailable",
    };
  }
  const input = Number(usage?.input_tokens ?? 0);
  const output = Number(usage?.output_tokens ?? 0);
  return {
    currency: pricing.currency ?? "USD",
    estimated_total:
      (input / 1_000_000) * Number(pricing.input_per_1m ?? 0) +
      (output / 1_000_000) * Number(pricing.output_per_1m ?? 0),
    source: pricing.source ?? "model_metadata",
  };
}

export function getTokenUsage(messages = []) {
  const text = messages.map((message) => message.content ?? "").join("\n");
  return {
    estimated_tokens: estimateTokens(text),
  };
}

export function buildSystemPrompt({ contextAttachments = [] } = {}) {
  const attachmentSummary = contextAttachments.length === 0
    ? "No BeHeart context attachments are active."
    : contextAttachments.map((attachment) => {
        return `- ${attachment.type}: ${attachment.label}. ${attachment.summary}`.slice(0, 700);
      }).join("\n");
  return [
    "You are BeHeart AI Agent, an AI workbench for software teams.",
    "Ground answers in durable repo memory, context packs, docs/specs, graph evidence, domain packs, benchmark artifacts, and governance warnings.",
    "Be explicit when an answer is source-backed versus a generated hypothesis.",
    "Do not request or reveal API keys, secrets, or private credentials.",
    "Only suggest allowlisted BeHeart actions. Risky actions require explicit confirmation.",
    "",
    "Active BeHeart context:",
    attachmentSummary,
  ].join("\n");
}

export function createArtifactFromChat({ title, summary, cardType = "generated_artifact", data = {} } = {}) {
  return {
    schema_version: 1,
    card_type: cardType,
    title,
    summary,
    status: "ready",
    data,
  };
}

function buildAttachmentCitations(attachments) {
  return attachments.flatMap((attachment) => attachment.citations ?? []);
}

function buildAttachmentArtifactCards(attachments) {
  return attachments.map((attachment) => ({
    schema_version: 1,
    card_type: "context_attachment",
    title: attachment.label,
    summary: attachment.summary,
    status: "attached",
    data: {
      type: attachment.type,
      source_ref: attachment.source_ref,
    },
  }));
}

function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / 4);
}

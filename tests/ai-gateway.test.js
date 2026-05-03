import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  estimateProviderCost,
  mapProviderError,
  sendModelRequest,
  streamModelResponse,
  validateProviderCredential,
} from "../packages/ai-gateway/src/index.js";

test("ai gateway sends OpenAI Responses requests and normalizes usage", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-test");
    assert.equal(body.input[0].role, "user");
    return jsonResponse({
      model: "gpt-test",
      output_text: "Hello from BeHeart.",
      usage: { input_tokens: 5, output_tokens: 4, total_tokens: 9 },
    });
  };

  const response = await sendModelRequest({
    providerId: "openai",
    modelId: "gpt-test",
    credential: { api_key: "sk-test-openai" },
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  });

  assert.equal(response.output_text, "Hello from BeHeart.");
  assert.equal(response.usage.total_tokens, 9);
  assert.equal(response.raw_response.usage.total_tokens, 9);
});

test("ai gateway validates provider keys through model discovery", async () => {
  const fetchImpl = async () => jsonResponse({ data: [{ id: "gpt-test" }] });
  const result = await validateProviderCredential({
    providerId: "openai",
    credential: { api_key: "sk-test-openai" },
    fetchImpl,
    env: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.model_count, 1);
});

test("ai gateway validates Bedrock credentials with SigV4 model discovery", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, "https://bedrock.us-west-2.amazonaws.com/foundation-models");
    assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIABEDROCKTEST\/\d{8}\/us-west-2\/bedrock\/aws4_request/);
    assert.equal(options.headers["X-Amz-Security-Token"], "session-token");
    return jsonResponse({
      modelSummaries: [{
        modelId: "amazon.nova-pro-v1:0",
        modelName: "Nova Pro",
        providerName: "Amazon",
        responseStreamingSupported: true,
        inputModalities: ["TEXT"],
        outputModalities: ["TEXT"],
      }],
    });
  };
  const result = await validateProviderCredential({
    providerId: "bedrock",
    fetchImpl,
    env: {
      AWS_ACCESS_KEY_ID: "AKIABEDROCKTEST",
      AWS_SECRET_ACCESS_KEY: "bedrock-secret",
      AWS_SESSION_TOKEN: "session-token",
      AWS_REGION: "us-west-2",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ok");
  assert.equal(result.model_count, 1);
  assert.equal(result.models[0].model_id, "amazon.nova-pro-v1:0");
  assert.equal(calls.length, 1);
});

test("ai gateway loads Bedrock static credentials from AWS_PROFILE", async (t) => {
  const fakeAwsHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-aws-profile-"));
  t.after(() => fs.rm(fakeAwsHome, { recursive: true, force: true }));
  const credentialsPath = path.join(fakeAwsHome, "credentials");
  await fs.writeFile(credentialsPath, [
    "[bedrock-dev]",
    "aws_access_key_id = AKIAPROFILETEST",
    "aws_secret_access_key = profile-secret",
    "aws_session_token = profile-token",
    "region = us-west-2",
    "",
  ].join("\n"));

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, "https://bedrock.us-west-2.amazonaws.com/foundation-models");
    assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIAPROFILETEST\/\d{8}\/us-west-2\/bedrock\/aws4_request/);
    assert.equal(options.headers["X-Amz-Security-Token"], "profile-token");
    return jsonResponse({ modelSummaries: [] });
  };

  const result = await validateProviderCredential({
    providerId: "bedrock",
    fetchImpl,
    env: {
      AWS_PROFILE: "bedrock-dev",
      AWS_SHARED_CREDENTIALS_FILE: credentialsPath,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ok");
  assert.equal(calls.length, 1);
});

test("ai gateway resolves Bedrock assume-role AWS profiles through STS", async (t) => {
  const fakeAwsHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-aws-role-"));
  t.after(() => fs.rm(fakeAwsHome, { recursive: true, force: true }));
  const credentialsPath = path.join(fakeAwsHome, "credentials");
  const configPath = path.join(fakeAwsHome, "config");
  await fs.writeFile(credentialsPath, [
    "[source]",
    "aws_access_key_id = AKIASOURCETEST",
    "aws_secret_access_key = source-secret",
    "region = us-east-1",
    "",
  ].join("\n"));
  await fs.writeFile(configPath, [
    "[profile bedrock-role]",
    "role_arn = arn:aws:iam::123456789012:role/BedrockAccess",
    "source_profile = source",
    "region = us-west-2",
    "",
  ].join("\n"));

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === "https://sts.us-west-2.amazonaws.com/") {
      assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIASOURCETEST\/\d{8}\/us-west-2\/sts\/aws4_request/);
      assert.match(options.body, /Action=AssumeRole/);
      assert.match(options.body, /RoleArn=arn%3Aaws%3Aiam%3A%3A123456789012%3Arole%2FBedrockAccess/);
      return xmlResponse(`
        <AssumeRoleResponse>
          <AssumeRoleResult>
            <Credentials>
              <AccessKeyId>ASIAROLETEST</AccessKeyId>
              <SecretAccessKey>role-secret</SecretAccessKey>
              <SessionToken>role-token</SessionToken>
              <Expiration>2026-05-03T12:00:00Z</Expiration>
            </Credentials>
          </AssumeRoleResult>
        </AssumeRoleResponse>
      `);
    }
    assert.equal(url, "https://bedrock.us-west-2.amazonaws.com/foundation-models");
    assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=ASIAROLETEST\/\d{8}\/us-west-2\/bedrock\/aws4_request/);
    assert.equal(options.headers["X-Amz-Security-Token"], "role-token");
    return jsonResponse({ modelSummaries: [] });
  };

  const result = await validateProviderCredential({
    providerId: "bedrock",
    fetchImpl,
    env: {
      AWS_PROFILE: "bedrock-role",
      AWS_SHARED_CREDENTIALS_FILE: credentialsPath,
      AWS_CONFIG_FILE: configPath,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls.map((call) => call.url).join(","), "https://sts.us-west-2.amazonaws.com/,https://bedrock.us-west-2.amazonaws.com/foundation-models");
});

test("ai gateway streams normalized fallback events", async () => {
  const fetchImpl = async () => jsonResponse({
    model: "gpt-test",
    output_text: "streamed text",
    usage: { total_tokens: 2 },
  });
  const events = [];
  for await (const event of streamModelResponse({
    providerId: "openai",
    modelId: "gpt-test",
    credential: { api_key: "sk-test-openai" },
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  })) {
    events.push(event.event);
  }

  assert.deepEqual(events, ["run_started", "assistant_delta", "usage", "run_completed"]);
});

test("ai gateway parses native OpenAI SSE events", async () => {
  const seenBodies = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    seenBodies.push(body);
    assert.equal(body.stream, true);
    return sseResponse([
      { type: "response.output_text.delta", delta: "Hello " },
      { type: "response.output_text.delta", delta: "stream." },
      { type: "response.completed", response: { usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } } },
      "[DONE]",
    ]);
  };
  const events = [];
  for await (const event of streamModelResponse({
    providerId: "openai",
    modelId: "gpt-test",
    credential: { api_key: "sk-test-openai" },
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  })) {
    events.push(event);
  }

  assert.equal(events.filter((event) => event.event === "assistant_delta").map((event) => event.delta).join(""), "Hello stream.");
  assert.equal(events.find((event) => event.event === "usage").usage.total_tokens, 5);
  assert.equal(events.at(-1).response.output_text, "Hello stream.");
  assert.equal(seenBodies.length, 1);
});

test("ai gateway parses native Anthropic SSE events", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(JSON.parse(options.body).stream, true);
    return sseResponse([
      { type: "content_block_delta", delta: { type: "text_delta", text: "Claude " } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "stream." } },
      { type: "message_delta", usage: { input_tokens: 4, output_tokens: 3 } },
      { type: "message_stop" },
    ]);
  };
  const events = [];
  for await (const event of streamModelResponse({
    providerId: "anthropic",
    modelId: "claude-test",
    credential: { api_key: "sk-ant-test" },
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  })) {
    events.push(event);
  }

  assert.equal(events.filter((event) => event.event === "assistant_delta").map((event) => event.delta).join(""), "Claude stream.");
  assert.equal(events.find((event) => event.event === "usage").usage.total_tokens, 7);
});

test("ai gateway parses OpenAI-compatible SSE events for local LM Studio", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/chat/completions");
    assert.equal(options.headers.Authorization, undefined);
    return sseResponse([
      { choices: [{ delta: { content: "Local " } }] },
      { choices: [{ delta: { content: "stream." }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } },
      "[DONE]",
    ]);
  };
  const events = [];
  for await (const event of streamModelResponse({
    providerId: "lmstudio",
    modelId: "local-model",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  })) {
    events.push(event);
  }

  assert.equal(events.filter((event) => event.event === "assistant_delta").map((event) => event.delta).join(""), "Local stream.");
  assert.equal(events.find((event) => event.event === "usage").usage.total_tokens, 5);
});

test("ai gateway sends local Ollama chat without authorization", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      model: "llama3.2",
      message: { role: "assistant", content: "Local answer." },
      prompt_eval_count: 4,
      eval_count: 3,
    });
  };

  const response = await sendModelRequest({
    providerId: "ollama",
    modelId: "llama3.2",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {},
  });

  assert.equal(response.output_text, "Local answer.");
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test("ai gateway sends Bedrock Converse requests with SigV4 signing", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url, "https://bedrock-runtime.us-west-2.amazonaws.com/model/amazon.nova-pro-v1%3A0/converse");
    assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIABEDROCKTEST\/\d{8}\/us-west-2\/bedrock\/aws4_request/);
    assert.equal(options.headers["X-Amz-Content-Sha256"].length, 64);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.system, [{ text: "Use BeHeart context." }]);
    assert.equal(body.messages[0].content[0].text, "hello");
    assert.equal(body.inferenceConfig.maxTokens, 2000);
    return jsonResponse({
      output: {
        message: {
          role: "assistant",
          content: [{ text: "Bedrock source-backed answer." }],
        },
      },
      usage: { inputTokens: 6, outputTokens: 4, totalTokens: 10 },
      stopReason: "end_turn",
    });
  };

  const response = await sendModelRequest({
    providerId: "bedrock",
    modelId: "amazon.nova-pro-v1:0",
    system: "Use BeHeart context.",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {
      AWS_ACCESS_KEY_ID: "AKIABEDROCKTEST",
      AWS_SECRET_ACCESS_KEY: "bedrock-secret",
      AWS_REGION: "us-west-2",
    },
  });

  assert.equal(response.output_text, "Bedrock source-backed answer.");
  assert.equal(response.usage.total_tokens, 10);
  assert.equal(response.raw_response.usage.totalTokens, 10);
  assert.equal(calls.length, 1);
});

test("ai gateway parses Bedrock ConverseStream event-stream frames", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://bedrock-runtime.us-west-2.amazonaws.com/model/amazon.nova-pro-v1%3A0/converse-stream");
    assert.match(options.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIABEDROCKTEST\/\d{8}\/us-west-2\/bedrock\/aws4_request/);
    assert.equal(options.headers.Accept, "application/vnd.amazon.eventstream");
    return eventStreamResponse([
      bedrockEvent("messageStart", { messageStart: { role: "assistant" } }),
      bedrockEvent("contentBlockDelta", { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "Bedrock " } } }),
      bedrockEvent("contentBlockDelta", { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "stream." } } }),
      bedrockEvent("metadata", { metadata: { usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 } } }),
      bedrockEvent("messageStop", { messageStop: { stopReason: "end_turn" } }),
    ]);
  };
  const events = [];
  for await (const event of streamModelResponse({
    providerId: "bedrock",
    modelId: "amazon.nova-pro-v1:0",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl,
    env: {
      AWS_ACCESS_KEY_ID: "AKIABEDROCKTEST",
      AWS_SECRET_ACCESS_KEY: "bedrock-secret",
      AWS_REGION: "us-west-2",
    },
  })) {
    events.push(event);
  }

  assert.equal(events.filter((event) => event.event === "assistant_delta").map((event) => event.delta).join(""), "Bedrock stream.");
  assert.equal(events.find((event) => event.event === "usage").usage.total_tokens, 7);
  assert.equal(events.at(-1).event, "run_completed");
  assert.equal(events.at(-1).response.output_text, "Bedrock stream.");
});

test("ai gateway reports Bedrock missing AWS credentials without network calls", async () => {
  let called = false;
  const result = await validateProviderCredential({
    providerId: "bedrock",
    fetchImpl: async () => {
      called = true;
      return jsonResponse({});
    },
    env: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_aws_credentials");
  assert.equal(called, false);
});

test("ai gateway preserves zero-cost metadata for local models", () => {
  const cost = estimateProviderCost({
    providerId: "ollama",
    modelId: "llama3.2",
    usage: { input_tokens: 12, output_tokens: 8 },
  });

  assert.equal(cost.estimated_total, 0);
  assert.equal(cost.source, "local_runtime");
});

test("ai gateway maps provider errors without leaking keys", () => {
  const error = mapProviderError({
    status: 401,
    message: "bad sk-secret-value-12345 AKIAIOSFODNN7EXAMPLE aws_secret_access_key=super-secret",
  }, { providerId: "openai" });

  assert.equal(error.code, "auth_error");
  assert.doesNotMatch(error.message, /sk-secret/);
  assert.doesNotMatch(error.message, /AKIA/);
  assert.doesNotMatch(error.message, /super-secret/);
});

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function xmlResponse(payload, init = {}) {
  return new Response(payload, {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/xml" },
  });
}

function sseResponse(events) {
  const payload = events
    .map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(payload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function eventStreamResponse(frames) {
  return new Response(Buffer.concat(frames), {
    status: 200,
    headers: { "Content-Type": "application/vnd.amazon.eventstream" },
  });
}

function bedrockEvent(eventType, payload) {
  return awsEventStreamFrame({
    ":message-type": "event",
    ":event-type": eventType,
    ":content-type": "application/json",
  }, JSON.stringify(payload));
}

function awsEventStreamFrame(headers, payload) {
  const headerBytes = Buffer.concat(Object.entries(headers).map(([name, value]) => awsEventStreamStringHeader(name, value)));
  const payloadBytes = Buffer.from(payload);
  const totalLength = 12 + headerBytes.length + payloadBytes.length + 4;
  const frame = Buffer.alloc(totalLength);
  frame.writeUInt32BE(totalLength, 0);
  frame.writeUInt32BE(headerBytes.length, 4);
  frame.writeUInt32BE(0, 8);
  headerBytes.copy(frame, 12);
  payloadBytes.copy(frame, 12 + headerBytes.length);
  frame.writeUInt32BE(0, totalLength - 4);
  return frame;
}

function awsEventStreamStringHeader(name, value) {
  const nameBytes = Buffer.from(name);
  const valueBytes = Buffer.from(value);
  const header = Buffer.alloc(1 + nameBytes.length + 1 + 2 + valueBytes.length);
  let offset = 0;
  header.writeUInt8(nameBytes.length, offset);
  offset += 1;
  nameBytes.copy(header, offset);
  offset += nameBytes.length;
  header.writeUInt8(7, offset);
  offset += 1;
  header.writeUInt16BE(valueBytes.length, offset);
  offset += 2;
  valueBytes.copy(header, offset);
  return header;
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComboTargetRequestConfig,
  normalizeComboTargetRequestConfig,
} from "../../../open-sse/services/targetRequestConfig.ts";
import { normalizeComboStep } from "../../../src/lib/combos/steps.ts";
import { createComboSchema } from "../../../src/shared/validation/schemas/combo.ts";

test("applies target defaults without replacing explicit request values", () => {
  const result = applyComboTargetRequestConfig(
    "audio-speech",
    { input: "hello", response_format: "wav" },
    {
      defaults: { response_format: "mp3", speed: 1.1 },
    }
  );

  assert.deepEqual(result, { input: "hello", response_format: "wav", speed: 1.1 });
});

test("maps logical TTS voices to the selected provider voice", () => {
  const config = {
    mappings: {
      voice: {
        default: "it-IT-ElsaNeural",
        male: "it-IT-DiegoNeural",
        female: "it-IT-ElsaNeural",
      },
    },
  };

  assert.equal(
    applyComboTargetRequestConfig("audio-speech", { voice: "male" }, config).voice,
    "it-IT-DiegoNeural"
  );
  assert.equal(
    applyComboTargetRequestConfig("audio-speech", { voice: "DEFAULT" }, config).voice,
    "it-IT-ElsaNeural"
  );
  assert.equal(applyComboTargetRequestConfig("audio-speech", {}, config).voice, "it-IT-ElsaNeural");
});

test("preserves provider-native values that are not logical aliases", () => {
  const result = applyComboTargetRequestConfig(
    "audio-speech",
    { voice: "custom-provider-voice" },
    { mappings: { voice: { female: "nova" } } }
  );

  assert.equal(result.voice, "custom-provider-voice");
});

test("ignores content-bearing and endpoint-incompatible configured fields", () => {
  const result = applyComboTargetRequestConfig(
    "ocr",
    { image: "original" },
    {
      defaults: { image: "replacement", language: "it", voice: "invalid-for-ocr" },
      mappings: { image: { original: "replacement" } },
    }
  );

  assert.deepEqual(result, { image: "original", language: "it" });
});

test("normalizes and preserves request configuration on model steps", () => {
  const step = normalizeComboStep({
    kind: "model",
    id: "azure-tts",
    model: "azure-speech/neural",
    requestConfig: {
      defaults: { response_format: "mp3" },
      mappings: { voice: { default: "it-IT-ElsaNeural" } },
    },
  });

  assert.equal(step?.kind, "model");
  if (!step || step.kind !== "model") return;
  assert.deepEqual(step.requestConfig, {
    defaults: { response_format: "mp3" },
    mappings: { voice: { default: "it-IT-ElsaNeural" } },
  });
});

test("drops malformed target request configuration values", () => {
  assert.deepEqual(
    normalizeComboTargetRequestConfig({
      defaults: { speed: { invalid: true }, language: "it" },
      mappings: { voice: { female: ["invalid"], default: "alloy" } },
    }),
    {
      defaults: { language: "it" },
      mappings: { voice: { default: "alloy" } },
    }
  );
});

test("combo API validation accepts bounded target defaults and mappings", () => {
  const result = createComboSchema.safeParse({
    name: "portable-tts",
    strategy: "priority",
    models: ["openai/gpt-4o-mini"],
    routes: {
      "audio-speech": {
        strategy: "priority",
        models: [
          {
            kind: "model",
            model: "azure-speech/neural",
            requestConfig: {
              defaults: { response_format: "mp3" },
              mappings: {
                voice: {
                  default: "it-IT-ElsaNeural",
                  male: "it-IT-DiegoNeural",
                  female: "it-IT-ElsaNeural",
                },
              },
            },
          },
        ],
      },
    },
  });

  assert.equal(result.success, true);
});

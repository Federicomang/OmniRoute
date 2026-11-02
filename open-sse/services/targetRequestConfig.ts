export type ComboTargetEndpoint =
  | "chat"
  | "search"
  | "web-fetch"
  | "embeddings"
  | "rerank"
  | "images"
  | "image-edits"
  | "videos"
  | "music"
  | "ocr"
  | "audio-speech"
  | "audio-transcriptions"
  | "audio-translations"
  | "audio-generation";

export type ComboTargetRequestValue = string | number | boolean | null;

export type ComboTargetRequestConfig = {
  defaults?: Record<string, ComboTargetRequestValue>;
  mappings?: Record<string, Record<string, ComboTargetRequestValue>>;
};

export const COMBO_TARGET_REQUEST_FIELDS: Record<ComboTargetEndpoint, readonly string[]> = {
  chat: ["temperature", "top_p", "max_tokens", "max_completion_tokens", "reasoning_effort", "seed"],
  search: [
    "max_results",
    "search_type",
    "offset",
    "country",
    "language",
    "time_range",
    "strict_filters",
  ],
  "web-fetch": ["format", "depth", "wait_for_selector", "include_metadata"],
  embeddings: ["dimensions", "encoding_format"],
  rerank: ["top_n", "return_documents"],
  images: ["n", "size", "quality", "style", "response_format", "output_format", "background"],
  "image-edits": ["n", "size", "quality", "response_format", "output_format", "background"],
  videos: ["duration", "size", "aspect_ratio", "resolution", "fps", "output_format"],
  music: [
    "duration",
    "music_length_ms",
    "force_instrumental",
    "respect_sections_durations",
    "seed",
    "output_format",
  ],
  ocr: ["language", "output_format", "detail", "include_image_base64", "table_format"],
  "audio-speech": [
    "voice",
    "response_format",
    "speed",
    "language",
    "language_code",
    "stability",
    "similarity_boost",
    "style",
    "timestamps",
  ],
  "audio-transcriptions": ["language", "response_format", "temperature"],
  "audio-translations": ["language", "response_format", "temperature"],
  "audio-generation": [
    "voice",
    "response_format",
    "output_format",
    "duration",
    "duration_seconds",
    "prompt_influence",
    "loop",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isRequestValue(value: unknown): value is ComboTargetRequestValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeValueRecord(value: unknown): Record<string, ComboTargetRequestValue> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: Record<string, ComboTargetRequestValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const field = key.trim();
    if (field && isRequestValue(entry)) normalized[field] = entry;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeComboTargetRequestConfig(
  value: unknown
): ComboTargetRequestConfig | undefined {
  if (!isRecord(value)) return undefined;
  const defaults = normalizeValueRecord(value.defaults);
  const mappings = isRecord(value.mappings)
    ? Object.fromEntries(
        Object.entries(value.mappings).flatMap(([field, aliases]) => {
          const normalized = normalizeValueRecord(aliases);
          return normalized ? [[field.trim(), normalized] as const] : [];
        })
      )
    : undefined;
  const normalizedMappings = mappings && Object.keys(mappings).length > 0 ? mappings : undefined;
  if (!defaults && !normalizedMappings) return undefined;
  return {
    ...(defaults ? { defaults } : {}),
    ...(normalizedMappings ? { mappings: normalizedMappings } : {}),
  };
}

function mappedValue(
  aliases: Record<string, ComboTargetRequestValue>,
  value: unknown
): ComboTargetRequestValue | undefined {
  if (value === undefined || value === null || value === "") return aliases.default;
  if (typeof value !== "string") return undefined;
  if (Object.prototype.hasOwnProperty.call(aliases, value)) return aliases[value];
  const normalized = value.trim().toLowerCase();
  const matchingKey = Object.keys(aliases).find((key) => key.toLowerCase() === normalized);
  return matchingKey ? aliases[matchingKey] : undefined;
}

/**
 * Apply provider-target defaults after a combo target is selected. Request values
 * win over defaults; logical aliases are then translated to provider-native values.
 * Content-bearing fields are never configurable because the endpoint allowlist only
 * contains operational parameters.
 */
export function applyComboTargetRequestConfig(
  endpoint: ComboTargetEndpoint,
  body: Record<string, unknown>,
  config: ComboTargetRequestConfig | null | undefined
): Record<string, unknown> {
  if (!config) return body;
  const allowed = new Set(COMBO_TARGET_REQUEST_FIELDS[endpoint]);
  const result = { ...body };

  for (const [field, value] of Object.entries(config.defaults || {})) {
    if (allowed.has(field) && result[field] === undefined) result[field] = value;
  }

  for (const [field, aliases] of Object.entries(config.mappings || {})) {
    if (!allowed.has(field)) continue;
    const mapped = mappedValue(aliases, result[field]);
    if (mapped !== undefined) result[field] = mapped;
  }

  return result;
}

import "server-only";

// Metadata-only logger. Never pass note content, prompts, or secrets here.
type Meta = Record<string, string | number | boolean | null | undefined>;

export const log = {
  info: (event: string, meta: Meta = {}) => console.info(JSON.stringify({ level: "info", event, ...meta })),
  warn: (event: string, meta: Meta = {}) => console.warn(JSON.stringify({ level: "warn", event, ...meta })),
  error: (event: string, meta: Meta = {}) => console.error(JSON.stringify({ level: "error", event, ...meta })),
};

import { z } from "zod";

const int = (fallback: number) => z.coerce.number().int().positive().catch(fallback);

const schema = z.object({
  DAILY_GENERATIONS_PER_USER: int(20),
  DAILY_TUTOR_MESSAGES_PER_USER: int(60),
  DAILY_ASSIST_ACTIONS_PER_USER: int(15),
  REQUESTS_PER_MINUTE_PER_USER: int(5),
  GLOBAL_DAILY_AI_BUDGET: int(900),
  MAX_INPUT_CHARS: int(60000),
  SIGNUPS_PER_IP_PER_HOUR: int(3),
});

export type LimitsConfig = {
  daily: { generation: number; tutor: number; assist: number };
  perMinute: number;
  globalDailyBudget: number;
  /** Fraction of the global budget at which new AI calls stop. */
  globalCutoff: number;
  maxInputChars: number;
  signupsPerIpPerHour: number;
};

export function readLimits(env: Record<string, string | undefined> = process.env): LimitsConfig {
  const e = schema.parse(env);
  return {
    daily: {
      generation: e.DAILY_GENERATIONS_PER_USER,
      tutor: e.DAILY_TUTOR_MESSAGES_PER_USER,
      assist: e.DAILY_ASSIST_ACTIONS_PER_USER,
    },
    perMinute: e.REQUESTS_PER_MINUTE_PER_USER,
    globalDailyBudget: e.GLOBAL_DAILY_AI_BUDGET,
    globalCutoff: 0.9,
    maxInputChars: e.MAX_INPUT_CHARS,
    signupsPerIpPerHour: e.SIGNUPS_PER_IP_PER_HOUR,
  };
}

// Upload caps, shared by the browser (before parsing) and the server (on the text/images we receive).
export const UPLOAD_LIMITS = {
  maxPhotos: 4,
  maxPdfBytes: 10 * 1024 * 1024,
  maxPdfPages: 30,
  maxPptxBytes: 10 * 1024 * 1024,
  maxImageDimension: 1600,
  /** Base64 JPEG after compression; ~1.5 MB per photo is plenty at 1600px. */
  maxImageDataUrlChars: 2_000_000,
} as const;

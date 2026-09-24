import { z } from "zod";
import type { UsageKind } from "../db/schema";

const int = (fallback: number) => z.coerce.number().int().positive().catch(fallback);

const schema = z.object({
  DAILY_GENERATIONS_PER_USER: int(20),
  DAILY_TUTOR_MESSAGES_PER_USER: int(60),
  DAILY_ASSIST_ACTIONS_PER_USER: int(15),
  DAILY_SHARES_PER_USER: int(10),
  DAILY_REPORTS_PER_USER: int(20),
  DAILY_FOLLOWS_PER_USER: int(100),
  REQUESTS_PER_MINUTE_PER_USER: int(5),
  GLOBAL_DAILY_AI_BUDGET: int(900),
  MAX_INPUT_CHARS: int(60000),
  SIGNUPS_PER_IP_PER_HOUR: int(3),
});

export type LimitsConfig = {
  daily: Record<UsageKind, number>;
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
      share: e.DAILY_SHARES_PER_USER,
      report: e.DAILY_REPORTS_PER_USER,
      follow: e.DAILY_FOLLOWS_PER_USER,
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
  // Files are parsed on the phone and never uploaded; only the text (capped by MAX_INPUT_CHARS) is sent.
  maxPdfBytes: 50 * 1024 * 1024,
  maxPdfPages: 60,
  maxPptxBytes: 50 * 1024 * 1024,
  maxImageDimension: 1600,
  /** Base64 JPEG after compression; ~1.5 MB per photo is plenty at 1600px. */
  maxImageDataUrlChars: 2_000_000,
} as const;

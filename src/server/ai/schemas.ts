import { z } from "zod";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const cardSchema = z.object({
  term: trimmed(300),
  definition: trimmed(1500),
  example: z.string().trim().max(800).nullish(),
});

export const summaryAndCardsSchema = z.object({
  title: z.string().trim().max(120).nullish(),
  summary: trimmed(20000),
  cards: z.array(cardSchema).min(1).max(80),
});
export type SummaryAndCards = z.infer<typeof summaryAndCardsSchema>;
export type GeneratedCard = z.infer<typeof cardSchema>;

export const extractedTextSchema = z.object({
  text: z.string().max(20000),
});

export const moderationSchema = z.object({
  verdict: z.enum(["allow", "review", "block"]),
  categories: z.array(z.string()).max(10).catch([]),
  reason: z.string().max(300).nullish().transform((r) => r ?? null),
});

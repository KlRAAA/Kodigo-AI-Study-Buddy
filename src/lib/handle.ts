import { z } from "zod";

export const RESERVED_HANDLES = new Set([
  "admin",
  "api",
  "auth",
  "banned",
  "explore",
  "guidelines",
  "help",
  "kodigo",
  "moderator",
  "privacy",
  "profile",
  "settings",
  "support",
  "terms",
]);

/** Public username: 3–20 of a–z, 0–9, _ (stored lowercase). */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/)
  .refine((h) => !RESERVED_HANDLES.has(h));

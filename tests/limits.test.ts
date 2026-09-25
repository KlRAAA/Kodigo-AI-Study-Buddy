import { beforeEach, describe, expect, it } from "vitest";
import { manilaDay, nextUtcMidnight } from "@/lib/day";
import {
  consumeDaily,
  consumeGlobal,
  consumeRate,
  consumeSignup,
  consumeThrottle,
  getDailyUsage,
  refundDaily,
  resetUserCounters,
} from "@/server/db/queries/usage";
import { readLimits } from "@/server/limits/config";
import { createTestDb } from "./helpers/db";

describe("day boundaries", () => {
  it("uses the Asia/Manila calendar day (UTC+8)", () => {
    expect(manilaDay(new Date("2026-09-24T15:59:59Z"))).toBe("2026-09-24");
    expect(manilaDay(new Date("2026-09-24T16:00:00Z"))).toBe("2026-09-25");
  });

  it("computes the next UTC midnight", () => {
    expect(nextUtcMidnight(new Date("2026-12-31T23:00:00Z"))).toEqual(new Date("2027-01-01T00:00:00Z"));
  });
});

describe("readLimits", () => {
  it("uses env values and falls back to defaults on junk", () => {
    const l = readLimits({ DAILY_GENERATIONS_PER_USER: "7", REQUESTS_PER_MINUTE_PER_USER: "abc" });
    expect(l.daily.generation).toBe(7);
    expect(l.perMinute).toBe(5);
    expect(l.globalCutoff).toBe(0.9);
  });

  it("reads community limits with defaults", () => {
    const l = readLimits({ DAILY_SHARES_PER_USER: "4" });
    expect(l.daily.share).toBe(4);
    expect(l.daily.report).toBe(20);
    expect(l.daily.follow).toBe(100);
    expect(l.daily.copy).toBe(30);
    expect(readLimits({ DAILY_COPIES_PER_USER: "5" }).daily.copy).toBe(5);
  });
});

describe("usage counters (Postgres)", () => {
  beforeEach(async () => {
    await createTestDb();
  });

  it("allows exactly `limit` generations per day, then refuses", async () => {
    const now = new Date("2026-09-24T02:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeDaily("u1", "generation", 3, now));
    expect(results).toEqual([1, 2, 3, null]);
    expect((await getDailyUsage("u1", now)).generation).toBe(3);
  });

  it("resets on the next Manila day", async () => {
    const day1 = new Date("2026-09-24T15:00:00Z"); // 23:00 Manila
    const day2 = new Date("2026-09-24T16:30:00Z"); // 00:30 Manila next day
    await consumeDaily("u1", "generation", 1, day1);
    expect(await consumeDaily("u1", "generation", 1, day1)).toBeNull();
    expect(await consumeDaily("u1", "generation", 1, day2)).toBe(1);
  });

  it("keeps kinds and users separate", async () => {
    const now = new Date();
    await consumeDaily("u1", "generation", 1, now);
    expect(await consumeDaily("u1", "tutor", 1, now)).toBe(1);
    expect(await consumeDaily("u2", "generation", 1, now)).toBe(1);
  });

  it("refunds a unit without going below zero", async () => {
    const now = new Date();
    await consumeDaily("u1", "generation", 2, now);
    await refundDaily("u1", "generation", now);
    await refundDaily("u1", "generation", now);
    expect((await getDailyUsage("u1", now)).generation).toBe(0);
  });

  it("enforces a sliding one-minute window", async () => {
    const t0 = new Date("2026-09-24T02:00:00Z");
    const at = (s: number) => new Date(t0.getTime() + s * 1000);
    expect(await consumeRate("u1", 2, at(0))).toBe(true);
    expect(await consumeRate("u1", 2, at(10))).toBe(true);
    expect(await consumeRate("u1", 2, at(20))).toBe(false);
    expect(await consumeRate("u1", 2, at(61))).toBe(true); // first request left the window
    expect(await consumeRate("u2", 2, at(20))).toBe(true);
  });

  it("caps the global daily budget", async () => {
    const now = new Date();
    expect(await consumeGlobal(2, now)).toBe(1);
    expect(await consumeGlobal(2, now)).toBe(2);
    expect(await consumeGlobal(2, now)).toBeNull();
  });

  it("throttles sign-ups per IP per hour", async () => {
    const now = new Date("2026-09-24T02:10:00Z");
    expect(await consumeSignup("ip", 2, now)).toBe(true);
    expect(await consumeSignup("ip", 2, now)).toBe(true);
    expect(await consumeSignup("ip", 2, now)).toBe(false);
    expect(await consumeSignup("ip", 2, new Date("2026-09-24T03:00:00Z"))).toBe(true);
  });

  it("throttles any key in its own time window", async () => {
    const t0 = new Date("2026-09-24T02:01:00Z");
    const tenMin = 10 * 60 * 1000;
    expect(await consumeThrottle("signin:ip1", 2, tenMin, t0)).toBe(true);
    expect(await consumeThrottle("signin:ip1", 2, tenMin, t0)).toBe(true);
    expect(await consumeThrottle("signin:ip1", 2, tenMin, t0)).toBe(false);
    expect(await consumeThrottle("signin:ip2", 2, tenMin, t0)).toBe(true); // other key
    expect(await consumeThrottle("signin:ip1", 2, tenMin, new Date("2026-09-24T02:10:00Z"))).toBe(true); // next window
  });

  it("admin reset clears today's counters", async () => {
    const now = new Date();
    await consumeDaily("u1", "generation", 1, now);
    await resetUserCounters("u1", now);
    expect(await consumeDaily("u1", "generation", 1, now)).toBe(1);
  });
});

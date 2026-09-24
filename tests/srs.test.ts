import { describe, expect, it } from "vitest";
import { formatInterval, NEW_CARD, previewIntervals, schedule } from "@/lib/srs";

const now = new Date("2026-09-25T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("SM-2 scheduling", () => {
  it("a new card rated Good comes back tomorrow, then in 6 days, then grows by ease", () => {
    const first = schedule(NEW_CARD, "good", now);
    expect(first).toMatchObject({ repetitions: 1, intervalDays: 1, lastGrade: 4 });
    expect(first.dueAt.getTime() - now.getTime()).toBe(DAY);

    const second = schedule(first, "good", now);
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6 });

    const third = schedule(second, "good", now);
    expect(third.repetitions).toBe(3);
    expect(third.intervalDays).toBe(Math.round(6 * second.ease));
  });

  it("Again resets the card, comes back in 10 minutes and lowers ease", () => {
    const learned = schedule(schedule(NEW_CARD, "good", now), "good", now);
    const missed = schedule(learned, "again", now);
    expect(missed).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 1, lastGrade: 1 });
    expect(missed.dueAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
    expect(missed.ease).toBeLessThan(learned.ease);
  });

  it("Easy grows faster than Good; Hard grows slower and lowers ease", () => {
    const base = schedule(schedule(NEW_CARD, "good", now), "good", now); // 6-day interval
    const easy = schedule(base, "easy", now);
    const good = schedule(base, "good", now);
    const hard = schedule(base, "hard", now);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(hard.intervalDays).toBeGreaterThanOrEqual(base.intervalDays);
    expect(hard.ease).toBeLessThan(base.ease);
  });

  it("ease never drops below 1.3", () => {
    let s = NEW_CARD;
    for (let i = 0; i < 20; i++) s = schedule(s, "again", now);
    expect(s.ease).toBe(1.3);
  });

  it("previews each button's next interval", () => {
    const p = previewIntervals(NEW_CARD, now);
    expect(p.again).toBe("10m");
    expect(p.good).toBe("1d");
    expect(formatInterval(0)).toBe("10m");
    expect(formatInterval(45)).toBe("1.5mo");
    expect(formatInterval(400)).toBe("1.1y");
  });
});

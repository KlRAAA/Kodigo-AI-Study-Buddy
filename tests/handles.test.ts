import { beforeEach, describe, expect, it } from "vitest";
import { handleSchema } from "@/lib/handle";
import { getOrCreateProfile, getProfileByHandle, isUniqueViolation, setHandle } from "@/server/db/queries/profiles";
import { createTestDb } from "./helpers/db";

describe("handle format", () => {
  it("accepts 3–20 lowercase letters, numbers, underscore; lowercases input", () => {
    expect(handleSchema.safeParse("Juan_01").data).toBe("juan_01");
    expect(handleSchema.safeParse("ab").success).toBe(false);
    expect(handleSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(handleSchema.safeParse("bad-name").success).toBe(false);
    expect(handleSchema.safeParse("admin").success).toBe(false);
    expect(handleSchema.safeParse("Explore").success).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("recognizes a 23505 code directly on the error", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("recognizes a 23505 code wrapped in err.cause (Drizzle's driver-error wrapping)", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("does not treat other errors as a unique violation", () => {
    expect(isUniqueViolation({ code: "08006" })).toBe(false); // connection failure
    expect(isUniqueViolation(new Error("connection dropped"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("setHandle", () => {
  beforeEach(async () => {
    await createTestDb();
    await getOrCreateProfile("u1");
    await getOrCreateProfile("u2");
  });

  it("claims a free handle and finds the profile by it", async () => {
    expect(await setHandle("u1", "juan")).toBe("ok");
    expect((await getProfileByHandle("juan"))?.userId).toBe("u1");
  });

  it("refuses a taken handle", async () => {
    await setHandle("u1", "juan");
    expect(await setHandle("u2", "juan")).toBe("taken");
  });

  it("allows one change per 30 days", async () => {
    const t0 = new Date("2026-09-01T00:00:00Z");
    expect(await setHandle("u1", "first", t0)).toBe("ok");
    expect(await setHandle("u1", "second", new Date("2026-09-10T00:00:00Z"))).toBe("too_soon");
    expect(await setHandle("u1", "second", new Date("2026-10-02T00:00:00Z"))).toBe("ok");
    expect(await getProfileByHandle("first")).toBeNull();
  });
});

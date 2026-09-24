import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { aiCache, aiCallLogs, aiModelStatus } from "../schema";

// AI bookkeeping. Not user data: the cache is keyed by a content hash and
// logs hold metadata only.

export async function getCached(hash: string): Promise<unknown | null> {
  const rows = await getDb().select({ result: aiCache.result }).from(aiCache).where(eq(aiCache.hash, hash)).limit(1);
  return rows[0]?.result ?? null;
}

export async function putCached(hash: string, task: string, lang: string, result: unknown) {
  await getDb().insert(aiCache).values({ hash, task, lang, result }).onConflictDoNothing();
}

export async function getBenchedModels(now = new Date()): Promise<Set<string>> {
  const rows = await getDb()
    .select({ id: aiModelStatus.providerModel, until: aiModelStatus.benchedUntil })
    .from(aiModelStatus);
  return new Set(rows.filter((r) => r.until && r.until > now).map((r) => r.id));
}

export async function benchModel(providerModel: string, until: Date, lastError: string) {
  await getDb()
    .insert(aiModelStatus)
    .values({ providerModel, benchedUntil: until, lastError, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiModelStatus.providerModel,
      set: { benchedUntil: until, lastError, updatedAt: new Date() },
    });
}

export async function listModelStatus() {
  return getDb().select().from(aiModelStatus).orderBy(aiModelStatus.providerModel);
}

export async function logAiCall(entry: typeof aiCallLogs.$inferInsert) {
  await getDb().insert(aiCallLogs).values(entry);
}

export async function purgeOldAiLogs(days = 30) {
  await getDb().delete(aiCallLogs).where(sql`${aiCallLogs.at} < now() - make_interval(days => ${days})`);
}

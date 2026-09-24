import { clear, get, set } from "idb-keyval";
import type { StudyCard } from "@/server/actions/sets";

export type CachedSet = { id: string; title: string; cards: StudyCard[]; savedAt: number };

const key = (id: string) => `set:${id}`;

/** Keeps a copy of an opened set in IndexedDB so study modes work briefly offline. */
export async function saveSetOffline(data: Omit<CachedSet, "savedAt">) {
  try {
    await set(key(data.id), { ...data, savedAt: Date.now() });
  } catch {
    // Private mode or storage full: the offline copy is best-effort.
  }
}

export async function loadSetOffline(id: string): Promise<CachedSet | null> {
  try {
    return (await get<CachedSet>(key(id))) ?? null;
  } catch {
    return null;
  }
}

/** Removes offline copies (called on sign-out and account deletion). */
export async function clearOfflineData() {
  try {
    await clear();
    if ("caches" in window) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
  } catch {
    // best-effort
  }
}

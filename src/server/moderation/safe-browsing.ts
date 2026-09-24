import "server-only";
import { ScreeningUnavailableError } from "./screen";

const ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

/** Google Safe Browsing v4 Lookup. Returns flagged URLs. Free for non-commercial use. */
export async function checkLinks(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];
  const key = process.env.SAFE_BROWSING_API_KEY;
  if (!key) {
    // Dev without a key: skip link checks. Production must never publish unchecked links.
    if (process.env.NODE_ENV === "production") throw new ScreeningUnavailableError();
    return [];
  }
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        client: { clientId: "kodigo", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urls.slice(0, 500).map((url) => ({ url })),
        },
      }),
    });
    if (!res.ok) throw new ScreeningUnavailableError();
    const data = (await res.json()) as { matches?: { threat?: { url?: string } }[] };
    return (data.matches ?? []).map((m) => m.threat?.url ?? "").filter(Boolean);
  } catch (err) {
    if (err instanceof ScreeningUnavailableError) throw err;
    throw new ScreeningUnavailableError();
  }
}

import "server-only";
import { contentHash, type ShareContent } from "../moderation/content";
import { ScreeningUnavailableError, type ScreenResult } from "../moderation/screen";
import { consumeDaily, refundDaily } from "../db/queries/usage";
import { getShareState, loadShareContent, newShareSlug, updateShareState } from "../db/queries/sharing";
import type { Profile, Visibility } from "../db/schema";
import { readLimits } from "../limits/config";
import { fail, ok, type ActionResult } from "../actions/result";

export type ShareOutcome = {
  status: "private" | "approved" | "review" | "blocked";
  slug?: string;
  categories?: string[];
};

type Args = {
  userId: string;
  profile: Pick<Profile, "handle" | "shareBlockedUntil" | "bannedAt">;
  setId: string;
  visibility: Visibility;
  screen: (c: ShareContent) => Promise<ScreenResult>;
  now?: Date;
};

/** Changes a set's visibility, screening it first when others could see it. */
export async function shareSet({ userId, profile, setId, visibility, screen, now = new Date() }: Args): Promise<ActionResult<ShareOutcome>> {
  if (profile.bannedAt) return fail("banned");
  const state = await getShareState(userId, setId);
  if (!state) return fail("not_found");

  if (visibility === "private") {
    await updateShareState(userId, setId, { visibility: "private" });
    return ok({ status: "private" });
  }
  if (!profile.handle) return fail("needs_handle");
  if (profile.shareBlockedUntil && profile.shareBlockedUntil > now) return fail("share_blocked");

  const content = await loadShareContent(userId, setId);
  if (!content || content.cards.length === 0) return fail("not_shareable");
  const hash = contentHash(content);
  const slug = state.shareSlug ?? newShareSlug();

  // Same content already approved: just change who can see it.
  if (state.moderatedHash === hash && state.moderationStatus === "approved") {
    await updateShareState(userId, setId, { visibility, shareSlug: slug, publishedAt: state.publishedAt ?? now });
    return ok({ status: "approved", slug });
  }
  // Same content already waiting for an admin: don't screen again.
  if (state.moderatedHash === hash && state.moderationStatus === "review") {
    await updateShareState(userId, setId, { visibility });
    return ok({ status: "review" });
  }

  if ((await consumeDaily(userId, "share", readLimits().daily.share, now)) === null) return fail("daily");

  let result: ScreenResult;
  try {
    result = await screen(content);
  } catch (err) {
    await refundDaily(userId, "share", now);
    if (err instanceof ScreeningUnavailableError) return fail("ai_unavailable");
    throw err;
  }

  const reason = result.categories.join(",") || result.reason;
  if (result.verdict === "allow") {
    await updateShareState(userId, setId, {
      visibility,
      moderationStatus: "approved",
      moderationReason: null,
      moderatedHash: hash,
      shareSlug: slug,
      publishedAt: state.publishedAt ?? now,
    });
    return ok({ status: "approved", slug });
  }
  if (result.verdict === "review") {
    // Keep the requested visibility; it only becomes visible once an admin approves.
    await updateShareState(userId, setId, { visibility, moderationStatus: "review", moderationReason: reason, moderatedHash: hash, shareSlug: slug });
    return ok({ status: "review" });
  }
  await updateShareState(userId, setId, { visibility: "private", moderationStatus: "blocked", moderationReason: reason, moderatedHash: hash });
  return ok({ status: "blocked", categories: result.categories });
}

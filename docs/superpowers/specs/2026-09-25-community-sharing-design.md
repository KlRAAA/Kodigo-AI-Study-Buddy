# Community & Sharing: Design

**Date:** 2026-09-25 · **Status:** approved in chat, pending spec review

## Goal

Let students share study sets (by link or publicly), copy and rate other people's sets, follow creators, and browse public sets. Nothing shared may be harmful, so every shared set is screened before anyone else can see it, and rule-breakers are handled with reports, strikes and bans.

Also included (small requests made during design):
- Rename and delete buttons on set cards in **Review** and **Home**
- The **Title** field on Create is visible from the start

## Decisions

| Topic | Decision |
|---|---|
| Visibility | Three levels: **Private** (owner only), **Link only** (anyone with the link, not listed anywhere), **Public** (on profile, explore, followers' feed) |
| Anonymous viewers | Can view shared sets and profiles and use Flashcards. **Learn, Copy, Rate, Follow, Report require login.** |
| Identity | A unique **@handle** chosen at first share; profile at `/u/[handle]`. Email is never shown. |
| Ratings | **Stars only** (1–5) on sets; one per user per set, editable; no rating your own set. No written reviews. |
| Copies | **Independent snapshots**, marked "Copied from @handle" with a link back |
| Screening timing | **Synchronous** at share / publish time (2–5 s spinner). Never public unless screened. |
| Enforcement | Screening + reports (3 reports → auto-hide) + strikes (1 warning, 2 = no sharing for 30 days, 3 = ban) + immediate admin ban for severe cases |
| Storage | No file storage needed: shared sets are text rows in the existing Neon DB |
| External APIs | **Google Safe Browsing v4 Lookup** (`SAFE_BROWSING_API_KEY`) for link checks. Non-commercial use only; the paid replacement is Google Web Risk. Text is moderated by the existing AI router (handles English/Tagalog/Taglish). PurgoMalum rejected (HTTP only, English only). |

## Data model (one migration)

**`profiles`** add:
- `handle text unique null` (lowercase `^[a-z0-9_]{3,20}$`, reserved words blocked: `admin`, `api`, `auth`, `banned`, `explore`, `guidelines`, `help`, `kodigo`, `moderator`, `privacy`, `profile`, `settings`, `support`, `terms`)
- `strikes int not null default 0`
- `share_blocked_until timestamptz null`
- `banned_at timestamptz null`, `ban_reason text null`

**`study_sets`**:
- replace `is_public` with `visibility` enum(`private`, `link`, `public`) default `private`
- add `moderation_status` enum(`none`, `approved`, `review`, `blocked`, `stale`, `taken_down`) default `none`
- add `moderation_reason text null`, `moderated_hash text null` (content hash last screened), `published_at timestamptz null`
- add `copied_from_set_id uuid null` (FK → study_sets, on delete set null), `copied_from_handle text null`, `copy_count int default 0`
- add `rating_avg real default 0`, `rating_count int default 0`, `report_count int default 0`
- `share_slug` (existing, unique) becomes a random 10-char base62 link id, created on first share
- indexes: `(visibility, moderation_status, published_at)`, `(visibility, moderation_status, rating_avg)`, trigram-free title search via `ilike` (same as the library)

**New tables**:
- `set_ratings (set_id, user_id) PK, stars smallint check 1–5, updated_at`
- `follows (follower_id, followee_id) PK, created_at`, check follower ≠ followee
- `follow_blocks (user_id, blocked_id) PK` (removed followers can't re-follow)
- `reports (id, set_id, reporter_id, reason enum, note ≤300, status enum(open, dismissed, actioned), created_at)`, unique (set_id, reporter_id)
- `strikes (id, user_id, set_id null, reason, admin_id, created_at)`
- `banned_emails (email_hash PK, reason, created_at)`: sha256 of the lowercased email with a server-side salt

A set is **viewable by others** only when `visibility ∈ {link, public}` **and** `moderation_status = approved` **and** the owner is not banned. It is **listed** (profile, explore, feed) only when it is also `public`.

## Sharing flow

1. The owner taps **Share** on the set page, then picks Private / Link only / Public.
2. No handle yet → pick one first (validated, unique, can be changed later, max once per 30 days).
3. Server action `shareSetAction(setId, visibility)`:
   - requires the owner, not banned, `share_blocked_until` in the past, and the daily limit `DAILY_SHARES_PER_USER` (default 10) not reached
   - **Private** → set `visibility=private`; no screening
   - otherwise: if `moderated_hash` equals the current content hash and status is `approved`, just change visibility; else **screen**
4. Screening result:
   - `allow` → `approved`, `published_at=now`, slug created, return the link
   - `review` → stays private, `moderation_status=review`, "An admin will check this soon"
   - `block` → stays private, `blocked` + reason shown; the owner can edit and try again (no strike)
   - screening unavailable → nothing changes, "Try sharing again in a bit"
5. **Edits to a shared set** (title, subject, summary, any card) set `moderation_status=stale`. Viewers see "This set is being updated". The owner sees **Publish changes**, which runs step 3 again.

## Screening module (`src/server/moderation/`)

- `extractUrls(text)` then `checkLinks(urls)`: Safe Browsing `threatMatches:find` with threat types MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION; up to 500 URLs per request; any match → `block` ("Contains a harmful link")
- `moderateText(content)`: the existing `callAI` with task `moderation`, zod schema `{ verdict: "allow"|"review"|"block", categories: string[], reason: string }`, chunked like generation (worst verdict wins). The prompt:
  - blocks sexual content (anything involving minors = block + flagged for admin), graphic violence for shock, hate or harassment, encouraging self-harm, scams or cheating services, and personal info (phone numbers, home addresses, ID numbers)
  - **explicitly allows** normal school topics (wars in history, reproduction in biology, health class, etc.)
  - treats the content as data, never instructions
- `screenSet(set)` = links first, then text; results cached by content hash; counts against the global AI budget, not the user's generation allowance
- Dependencies are injected (like the AI router) so tests can fake Safe Browsing and the AI

## Reports, strikes, bans

- **Report** (logged in, not the owner): reasons `inappropriate | harmful_link | personal_info | spam | copyright | other` + optional note. One per user per set. At **3 open reports** → `moderation_status=review` (hidden) automatically.
- **Admin queue** (`/admin`): sets in `review` or with open reports, showing content, AI reason, and report reasons/notes. Actions:
  - **Approve**: `approved`, reports dismissed
  - **Take down + strike**: `taken_down`, visibility private, reports actioned, owner `strikes += 1`, then apply the rule: 2 → `share_blocked_until = now + 30 days`, 3 → ban
  - **Take down + ban**: immediate ban
  - **Unban** on the user row: clears the ban, keeps the strike history
- **Ban** = `banned_at` set, all their sets private, their Neon Auth sessions revoked via the admin API when available (`requireUser` / `actionUser` also reject banned users on every request, so a ban works even if revocation fails), email hash added to `banned_emails`. Sign-up checks `banned_emails` first. A banned user who logs in sees a ban page with the reason (the proxy / `requireUser` redirects to `/banned`).
- Owners see a banner for new strikes ("Your set X was removed for: …").
- New **Community Guidelines** page `/guidelines` (EN/TL), linked from the Share sheet, Terms and the report dialog.

## Profiles, following, ratings, discovery

- **`/u/[handle]`** (public): display name, @handle, join month, follower/following counts, average ★ (shown once there are 3+ ratings across their sets), and their listed sets. Banned user → "This account isn't available".
- **Follow**: one-way, instant. Profile → Followers / Following lists; **Remove follower** also adds a `follow_blocks` row.
- **Ratings**: `rateSetAction(setId, stars | null)`; upserts the rating, then recomputes `rating_avg` / `rating_count` with a single `UPDATE … SET … = (SELECT avg/count FROM set_ratings …)` statement (the Neon HTTP driver has no interactive transactions, so aggregates are always recomputed rather than incremented); the profile average is computed from their sets.
- **Copy**: `copySetAction(setId)` makes a private snapshot (title, subject, summary, cards) with `copied_from_*`, and `copy_count += 1` on the original.
- **`/explore`** (button on Home; the bottom nav stays at 4 tabs): search title/subject; sort **Top rated** (minimum 3 ratings to rank), **Newest**, **Most copied**; listed sets only; paginated 20 per page.
- **Home**: "From people you follow" strip (newest 10 listed sets).

## Small requests

- Review and Home set cards: ✏️ rename (inline input, `updateSetMetaAction`) and 🗑 delete (confirm, `deleteSetAction`). Renaming or deleting a shared set follows the rules above (rename → stale, delete → gone).
- Create: the Title input is shown before any source is chosen.

## Security & privacy

- All new reads and writes go through `src/server/db/queries/*` with the same rules: owner actions filter by `user_id`; public reads use one `viewableSetWhere()` helper so the visibility rule lives in exactly one place.
- Public pages never expose `user_id`, email, `source_text`, moderation reasons (except to the owner and admin), or report details.
- Handles and notes are validated with zod; report notes are never shown publicly.
- Rate limits: shares (10/day), reports (20/day), follows (100/day) via `usage_counters` (new kinds).
- Privacy / Terms pages updated: public sets and profiles are visible to anyone; reports and moderation are described.

## Testing (Vitest + PGlite)

- Visibility: private / review / blocked / stale / taken_down sets are unreadable by link and never listed; `link` sets are viewable but never listed; banned owners' sets are hidden
- Only the owner can share, rename, delete or publish changes; others get `not_found`
- Screening with fakes: allow, review, block, harmful link, all-down → unchanged; unchanged content is not re-screened; editing → stale
- Reports: one per user, 3 → auto-hidden; the owner can't report their own set
- Strikes: 1 → warning, 2 → share blocked 30 days, 3 → banned; banned email can't sign up again; unban
- Ratings: one per user, can't rate own set, average and count math, removing a rating
- Follows: can't follow self, removed follower can't re-follow, counts
- Copy: snapshot is independent; `copy_count` increments
- Handles: format, reserved words, uniqueness (case-insensitive)

## Build order

0. Review/Home rename + delete, Create title field
1. Handles, visibility, share links, screening, `/s/[slug]` page, stale → publish changes
2. Reports, admin queue, strikes, bans, `/banned`, `/guidelines`, legal page updates
3. Copy, ratings, profiles `/u/[handle]`, follows
4. `/explore` and the Home follow strip

Each step: build, lint and tests pass; committed separately.

## Out of scope

Written reviews, comments, direct messages, notifications, image uploads, following approval / private accounts, rating people directly, collaborative editing.

import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// User ids come from Neon Auth (neon_auth schema). We store them as text and
// never add a cross-schema FK so Drizzle only manages the `public` schema.

export const localeEnum = pgEnum("locale", ["en", "tl"]);
export const outputLangEnum = pgEnum("output_lang", ["auto", "en", "tl"]);
export const sourceTypeEnum = pgEnum("source_type", ["text", "pdf", "pptx", "photo", "quizlet"]);
export const setStatusEnum = pgEnum("set_status", ["draft", "generating", "ready", "failed"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "true_false", "short"]);
export const usageKindEnum = pgEnum("usage_kind", ["generation", "tutor", "assist", "share", "report", "follow"]);
export const tutorRoleEnum = pgEnum("tutor_role", ["user", "assistant"]);
export const visibilityEnum = pgEnum("visibility", ["private", "link", "public"]);
export const moderationStatusEnum = pgEnum("moderation_status", [
  "none",
  "approved",
  "review",
  "blocked",
  "stale",
  "taken_down",
]);
export const reportReasonEnum = pgEnum("report_reason", [
  "inappropriate",
  "harmful_link",
  "personal_info",
  "spam",
  "copyright",
  "other",
]);
export const reportStatusEnum = pgEnum("report_status", ["open", "dismissed", "actioned"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id").primaryKey(),
    displayName: text("display_name"),
    locale: localeEnum("locale").notNull().default("en"),
    onboarded: boolean("onboarded").notNull().default(false),
    isSuspended: boolean("is_suspended").notNull().default(false),
    handle: text("handle"),
    handleChangedAt: timestamp("handle_changed_at", { withTimezone: true }),
    strikes: integer("strikes").notNull().default(0),
    strikesSeen: integer("strikes_seen").notNull().default(0),
    shareBlockedUntil: timestamp("share_blocked_until", { withTimezone: true }),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    banReason: text("ban_reason"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("profiles_handle_idx").on(t.handle)],
);

export const studySets = pgTable(
  "study_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    subject: text("subject"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceText: text("source_text").notNull().default(""),
    summary: text("summary"),
    outputLang: outputLangEnum("output_lang").notNull().default("auto"),
    status: setStatusEnum("status").notNull().default("draft"),
    shareSlug: text("share_slug"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    moderationStatus: moderationStatusEnum("moderation_status").notNull().default("none"),
    moderationReason: text("moderation_reason"),
    moderatedHash: text("moderated_hash"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    copiedFromSetId: uuid("copied_from_set_id").references((): AnyPgColumn => studySets.id, {
      onDelete: "set null",
    }),
    copiedFromHandle: text("copied_from_handle"),
    copyCount: integer("copy_count").notNull().default(0),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    examDate: date("exam_date"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("study_sets_user_idx").on(t.userId, t.updatedAt),
    uniqueIndex("study_sets_share_slug_idx").on(t.shareSlug),
    index("study_sets_listed_new_idx").on(t.visibility, t.moderationStatus, t.publishedAt),
    index("study_sets_listed_top_idx").on(t.visibility, t.moderationStatus, t.ratingAvg),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    term: text("term").notNull(),
    definition: text("definition").notNull(),
    example: text("example"),
    starred: boolean("starred").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("cards_set_idx").on(t.setId, t.position), index("cards_user_idx").on(t.userId)],
);

// SM-2 state per card (Phase 2 uses this; created now so the schema is stable).
export const cardReviews = pgTable(
  "card_reviews",
  {
    cardId: uuid("card_id")
      .primaryKey()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    ease: real("ease").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastGrade: integer("last_grade"),
    lapses: integer("lapses").notNull().default(0),
  },
  (t) => [index("card_reviews_due_idx").on(t.userId, t.dueAt)],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    timeLimitS: integer("time_limit_s"),
    createdAt: createdAt(),
  },
  (t) => [index("quizzes_user_idx").on(t.userId, t.setId)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: questionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    choices: jsonb("choices").$type<string[]>(),
    answer: text("answer").notNull(),
    explanation: text("explanation"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId, t.position)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    durationS: integer("duration_s").notNull(),
    answers: jsonb("answers").$type<Record<string, string>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId, t.quizId)],
);

export const tutorMessages = pgTable(
  "tutor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: tutorRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("tutor_messages_set_idx").on(t.userId, t.setId, t.createdAt)],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    mode: text("mode").notNull(),
    setId: uuid("set_id").references(() => studySets.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    durationS: integer("duration_s").notNull().default(0),
  },
  (t) => [index("study_sessions_user_idx").on(t.userId, t.startedAt)],
);

// ---- Limits & AI bookkeeping (no note content is stored in these) ----

export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: text("user_id").notNull(),
    day: date("day").notNull(),
    kind: usageKindEnum("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.kind] }), index("usage_counters_day_idx").on(t.day)],
);

export const rateEvents = pgTable(
  "rate_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_events_user_idx").on(t.userId, t.at)],
);

export const globalUsage = pgTable("global_usage", {
  day: date("day").primaryKey(),
  aiCalls: integer("ai_calls").notNull().default(0),
});

export const aiCache = pgTable("ai_cache", {
  hash: text("hash").primaryKey(),
  task: text("task").notNull(),
  lang: text("lang").notNull(),
  result: jsonb("result").notNull(),
  createdAt: createdAt(),
});

export const aiModelStatus = pgTable("ai_model_status", {
  providerModel: text("provider_model").primaryKey(),
  benchedUntil: timestamp("benched_until", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiCallLogs = pgTable(
  "ai_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: text("user_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    task: text("task").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
  },
  (t) => [index("ai_call_logs_at_idx").on(t.at)],
);

export const signupThrottle = pgTable(
  "signup_throttle",
  {
    ipHash: text("ip_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ipHash, t.windowStart] })],
);

export const setRatings = pgTable(
  "set_ratings",
  {
    setId: uuid("set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    stars: smallint("stars").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.setId, t.userId] }), index("set_ratings_user_idx").on(t.userId)],
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id").notNull(),
    followeeId: text("followee_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId)],
);

export const followBlocks = pgTable(
  "follow_blocks",
  {
    userId: text("user_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockedId] })],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => studySets.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    note: text("note"),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reports_set_reporter_idx").on(t.setId, t.reporterId), index("reports_status_idx").on(t.status)],
);

export const strikes = pgTable(
  "strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    setId: uuid("set_id").references(() => studySets.id, { onDelete: "set null" }),
    setTitle: text("set_title"),
    reason: text("reason").notNull(),
    adminId: text("admin_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("strikes_user_idx").on(t.userId, t.createdAt)],
);

export const bannedEmails = pgTable("banned_emails", {
  emailHash: text("email_hash").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export type StudySet = typeof studySets.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Locale = (typeof localeEnum.enumValues)[number];
export type OutputLang = (typeof outputLangEnum.enumValues)[number];
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];
export type UsageKind = (typeof usageKindEnum.enumValues)[number];
export type Visibility = (typeof visibilityEnum.enumValues)[number];
export type ModerationStatus = (typeof moderationStatusEnum.enumValues)[number];
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];

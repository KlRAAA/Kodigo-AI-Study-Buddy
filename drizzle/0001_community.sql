CREATE TYPE "public"."moderation_status" AS ENUM('none', 'approved', 'review', 'blocked', 'stale', 'taken_down');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('inappropriate', 'harmful_link', 'personal_info', 'spam', 'copyright', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'link', 'public');--> statement-breakpoint
ALTER TYPE "public"."usage_kind" ADD VALUE 'share';--> statement-breakpoint
ALTER TYPE "public"."usage_kind" ADD VALUE 'report';--> statement-breakpoint
ALTER TYPE "public"."usage_kind" ADD VALUE 'follow';--> statement-breakpoint
CREATE TABLE "banned_emails" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_blocks" (
	"user_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_blocks_user_id_blocked_id_pk" PRIMARY KEY("user_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_ratings" (
	"set_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"stars" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "set_ratings_set_id_user_id_pk" PRIMARY KEY("set_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"set_id" uuid,
	"set_title" text,
	"reason" text NOT NULL,
	"admin_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "handle_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "strikes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "strikes_seen" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "share_blocked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "visibility" "visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "moderation_status" "moderation_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "moderated_hash" text;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "copied_from_set_id" uuid;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "copied_from_handle" text;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "copy_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "rating_avg" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sets" ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_set_id_study_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."study_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_ratings" ADD CONSTRAINT "set_ratings_set_id_study_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."study_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_set_id_study_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."study_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_set_reporter_idx" ON "reports" USING btree ("set_id","reporter_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "set_ratings_user_idx" ON "set_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strikes_user_idx" ON "strikes" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "study_sets" ADD CONSTRAINT "study_sets_copied_from_set_id_study_sets_id_fk" FOREIGN KEY ("copied_from_set_id") REFERENCES "public"."study_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_idx" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "study_sets_listed_new_idx" ON "study_sets" USING btree ("visibility","moderation_status","published_at");--> statement-breakpoint
CREATE INDEX "study_sets_listed_top_idx" ON "study_sets" USING btree ("visibility","moderation_status","rating_avg");
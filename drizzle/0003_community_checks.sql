ALTER TYPE "public"."usage_kind" ADD VALUE 'copy';--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self_check" CHECK ("follows"."follower_id" <> "follows"."followee_id");--> statement-breakpoint
ALTER TABLE "set_ratings" ADD CONSTRAINT "set_ratings_stars_check" CHECK ("set_ratings"."stars" between 1 and 5);
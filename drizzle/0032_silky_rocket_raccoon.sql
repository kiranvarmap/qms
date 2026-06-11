ALTER TABLE "activity_feed" ADD COLUMN "event_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_feed_event_uq" ON "activity_feed" USING btree ("event_id");
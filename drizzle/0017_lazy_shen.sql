ALTER TABLE "workspaces" ADD COLUMN "country" varchar(2) DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "locale" varchar(10) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "timezone" varchar(64) DEFAULT 'UTC' NOT NULL;
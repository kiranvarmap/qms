CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('reported', 'investigating', 'actions_open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('injury', 'near_miss', 'property', 'environmental');--> statement-breakpoint
CREATE TYPE "public"."safety_action_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" varchar(60) NOT NULL,
	"type" "incident_type" DEFAULT 'near_miss' NOT NULL,
	"severity" "incident_severity" DEFAULT 'low' NOT NULL,
	"status" "incident_status" DEFAULT 'reported' NOT NULL,
	"occurred_at" timestamp,
	"location" varchar(255),
	"description" text,
	"asset_id" uuid,
	"reported_by" uuid,
	"investigator_id" uuid,
	"root_cause" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "incidents_ws_number_uq" UNIQUE("workspace_id","number")
);
--> statement-breakpoint
CREATE TABLE "safety_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"description" text NOT NULL,
	"assignee_id" uuid,
	"due_date" timestamp,
	"status" "safety_action_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_investigator_id_users_id_fk" FOREIGN KEY ("investigator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
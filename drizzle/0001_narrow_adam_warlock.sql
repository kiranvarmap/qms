CREATE TYPE "public"."event_status" AS ENUM('pending', 'processing', 'done', 'dead');--> statement-breakpoint
CREATE TYPE "public"."link_level" AS ENUM('none', 'workspace', 'board', 'group', 'item');--> statement-breakpoint
CREATE TYPE "public"."link_mode" AS ENUM('disabled', 'optional', 'required');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'worker';--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"board_id" uuid,
	"group_id" uuid,
	"item_id" uuid,
	"actor_user_id" uuid,
	"ref_type" varchar(30) NOT NULL,
	"ref_id" uuid,
	"action" varchar(50) NOT NULL,
	"summary" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"source_type" varchar(40) NOT NULL,
	"source_id" uuid NOT NULL,
	"target_type" varchar(40) NOT NULL,
	"target_id" uuid NOT NULL,
	"relation" varchar(40) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_links_source_type_source_id_target_type_target_id_relation_pk" PRIMARY KEY("source_type","source_id","target_type","target_id","relation")
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"aggregate_type" varchar(50),
	"aggregate_id" uuid,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"status" "event_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"module" varchar(30) NOT NULL,
	"mode" "link_mode" DEFAULT 'optional' NOT NULL,
	"allow_general" boolean DEFAULT true NOT NULL,
	"min_level" "link_level" DEFAULT 'none' NOT NULL,
	"max_level" "link_level" DEFAULT 'item' NOT NULL,
	"rung_rules" jsonb DEFAULT '[]' NOT NULL,
	"default_target" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "link_policies_workspace_id_module_pk" PRIMARY KEY("workspace_id","module")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_type_pk" PRIMARY KEY("user_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "pdf_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"workspace_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emp_projects" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "inspection_templates" ADD COLUMN "pdf_template_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "link_level" "link_level" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "report_file_path" text;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "ncr_status" varchar(20);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD COLUMN "link_level" "link_level" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_questions" ADD COLUMN "instructions" jsonb;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "time_logs" ADD COLUMN "link_level" "link_level" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_policies" ADD CONSTRAINT "link_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_policies" ADD CONSTRAINT "link_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_templates" ADD CONSTRAINT "pdf_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_templates" ADD CONSTRAINT "pdf_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emp_projects" ADD CONSTRAINT "emp_projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD CONSTRAINT "inspection_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD CONSTRAINT "inspection_actions_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_actions" ADD CONSTRAINT "inspection_actions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD CONSTRAINT "sign_documents_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD CONSTRAINT "sign_documents_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_documents" ADD CONSTRAINT "sign_documents_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_unique" UNIQUE("user_id");
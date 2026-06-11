CREATE TYPE "public"."permission_action" AS ENUM('view', 'create', 'edit', 'approve', 'admin');--> statement-breakpoint
CREATE TABLE "member_permission_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	CONSTRAINT "member_permission_sets_uq" UNIQUE("workspace_id","user_id","set_id")
);
--> statement-breakpoint
CREATE TABLE "permission_set_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"module" varchar(30) NOT NULL,
	"action" "permission_action" NOT NULL,
	CONSTRAINT "permission_set_entries_uq" UNIQUE("set_id","module","action")
);
--> statement-breakpoint
CREATE TABLE "permission_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permission_sets_ws_name_uq" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "member_permission_sets" ADD CONSTRAINT "member_permission_sets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_permission_sets" ADD CONSTRAINT "member_permission_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_permission_sets" ADD CONSTRAINT "member_permission_sets_set_id_permission_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."permission_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_set_entries" ADD CONSTRAINT "permission_set_entries_set_id_permission_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."permission_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_sets" ADD CONSTRAINT "permission_sets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_sets" ADD CONSTRAINT "permission_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
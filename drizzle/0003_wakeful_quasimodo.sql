CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."party_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_type" varchar(40) NOT NULL,
	"name" varchar(100) NOT NULL,
	"steps" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_policies_uq" UNIQUE("workspace_id","subject_type")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_type" varchar(40) NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"current_step" integer DEFAULT 1 NOT NULL,
	"policy_id" uuid,
	"board_id" uuid,
	"item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "approval_subject_uq" UNIQUE("subject_type","subject_id")
);
--> statement-breakpoint
CREATE TABLE "approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"approver_employee_id" uuid,
	"approver_role" varchar(30),
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"code" varchar(50),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"tax_id" varchar(100),
	"billing_address" jsonb DEFAULT '{}' NOT NULL,
	"shipping_address" jsonb DEFAULT '{}' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"account_manager_employee_id" uuid,
	"board_id" uuid,
	"notes" text,
	"status" "party_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_ws_code_uq" UNIQUE("workspace_id","code")
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"doc_type" varchar(40) NOT NULL,
	"scope_id" varchar(64) DEFAULT '' NOT NULL,
	"prefix" varchar(20) DEFAULT '' NOT NULL,
	"format" varchar(100) DEFAULT '{PREFIX}{SEQ}' NOT NULL,
	"padding" integer DEFAULT 4 NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doc_sequences_uq" UNIQUE("workspace_id","doc_type","scope_id")
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"rate_basis_points" integer DEFAULT 0 NOT NULL,
	"type" varchar(20) DEFAULT 'both' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"title" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"code" varchar(50),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"tax_id" varchar(100),
	"address" jsonb DEFAULT '{}' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"account_manager_employee_id" uuid,
	"notes" text,
	"status" "party_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_ws_code_uq" UNIQUE("workspace_id","code")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "manager_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_vendors" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_purchasing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_inventory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_invoicing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_expenses" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_hr" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "can_access_training" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "fiscal_year_start" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_employee_id_employees_id_fk" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_employee_id_employees_id_fk" FOREIGN KEY ("account_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_account_manager_employee_id_employees_id_fk" FOREIGN KEY ("account_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_employees_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
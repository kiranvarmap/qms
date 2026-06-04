CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"head_employee_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_ws_name_uq" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"entitled_days" real DEFAULT 0 NOT NULL,
	"taken_days" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_balances_uq" UNIQUE("employee_id","leave_type_id","period_year")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"days" real NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"covering_employee_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"default_days" real DEFAULT 0 NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_ws_name_uq" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" varchar(40);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "date_of_birth" timestamp;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_employee_id_employees_id_fk" FOREIGN KEY ("head_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_covering_employee_id_employees_id_fk" FOREIGN KEY ("covering_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
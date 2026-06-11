CREATE TYPE "public"."job_stage_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."material_reservation_status" AS ENUM('reserved', 'issued', 'released');--> statement-breakpoint
CREATE TYPE "public"."planning_conflict_severity" AS ENUM('warning', 'blocker');--> statement-breakpoint
CREATE TYPE "public"."planning_conflict_type" AS ENUM('material_shortage', 'machine_overload', 'manpower_short', 'skill_unavailable', 'maintenance_block', 'po_delay', 'delivery_impossible', 'no_template', 'no_work_center');--> statement-breakpoint
CREATE TYPE "public"."planning_status" AS ENUM('unplanned', 'feasible', 'conflict', 'infeasible');--> statement-breakpoint
CREATE TYPE "public"."process_template_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('trainee', 'qualified', 'expert');--> statement-breakpoint
CREATE TYPE "public"."work_center_type" AS ENUM('machine', 'manual', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE "employee_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) DEFAULT '08:00' NOT NULL,
	"end_time" varchar(5) DEFAULT '17:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" "skill_level" DEFAULT 'qualified' NOT NULL,
	"certified_until" timestamp,
	CONSTRAINT "employee_skills_uq" UNIQUE("employee_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "job_stage_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_stage_schedule_id" uuid NOT NULL,
	"employee_id" uuid,
	"role" varchar(60) DEFAULT 'operator' NOT NULL,
	"planned_hours" real DEFAULT 0 NOT NULL,
	"actual_hours" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_stage_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"stage_id" uuid,
	"stage_name" varchar(255) NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"planned_start" timestamp,
	"planned_end" timestamp,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"assigned_work_center_id" uuid,
	"assigned_machine_id" uuid,
	"status" "job_stage_status" DEFAULT 'pending' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "material_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"component_product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"qty_reserved" real DEFAULT 0 NOT NULL,
	"status" "material_reservation_status" DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "planning_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"conflict_type" "planning_conflict_type" NOT NULL,
	"severity" "planning_conflict_severity" DEFAULT 'warning' NOT NULL,
	"stage_id" uuid,
	"description" text NOT NULL,
	"suggested_action" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"parent_stage_id" uuid,
	"depends_on_stage_id" uuid,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"setup_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"work_center_id" uuid,
	"required_skill_id" uuid,
	"required_headcount" integer DEFAULT 1 NOT NULL,
	"qa_checkpoint_required" boolean DEFAULT false NOT NULL,
	"scrap_pct" real DEFAULT 0 NOT NULL,
	"output_qty" real DEFAULT 1 NOT NULL,
	"instructions" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "process_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"version" varchar(40) DEFAULT 'v1' NOT NULL,
	"name" varchar(255),
	"status" "process_template_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"approved_by" uuid,
	"effective_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "process_templates_product_version_uq" UNIQUE("product_id","version")
);
--> statement-breakpoint
CREATE TABLE "production_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_skills_ws_name_uq" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "stage_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"component_product_id" uuid,
	"description" varchar(255),
	"qty_per" real DEFAULT 1 NOT NULL,
	"unit" varchar(40) DEFAULT 'unit' NOT NULL,
	"wastage_pct" real DEFAULT 0 NOT NULL,
	"substitute_allowed" boolean DEFAULT false NOT NULL,
	"critical_item" boolean DEFAULT false NOT NULL,
	"required_before_start" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_center_machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"work_center_id" uuid NOT NULL,
	"asset_id" uuid,
	"name" varchar(255) NOT NULL,
	"capacity_pct" real DEFAULT 100 NOT NULL,
	"setup_minutes" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_center_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_center_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) DEFAULT '08:00' NOT NULL,
	"end_time" varchar(5) DEFAULT '17:00' NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(60),
	"type" "work_center_type" DEFAULT 'machine' NOT NULL,
	"department" varchar(120),
	"location" varchar(255),
	"capacity_hours_per_day" real DEFAULT 8 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_centers_ws_code_uq" UNIQUE("workspace_id","code")
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "priority" "work_order_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "process_template_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "sales_order_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "planned_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "planned_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "material_ready_date" timestamp;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "planning_status" "planning_status" DEFAULT 'unplanned' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "delivery_risk" varchar(20);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "planning_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "special_instructions" text;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_production_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."production_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_assignments" ADD CONSTRAINT "job_stage_assignments_job_stage_schedule_id_job_stage_schedules_id_fk" FOREIGN KEY ("job_stage_schedule_id") REFERENCES "public"."job_stage_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_assignments" ADD CONSTRAINT "job_stage_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_schedules" ADD CONSTRAINT "job_stage_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_schedules" ADD CONSTRAINT "job_stage_schedules_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_schedules" ADD CONSTRAINT "job_stage_schedules_stage_id_process_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."process_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_schedules" ADD CONSTRAINT "job_stage_schedules_assigned_work_center_id_work_centers_id_fk" FOREIGN KEY ("assigned_work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_stage_schedules" ADD CONSTRAINT "job_stage_schedules_assigned_machine_id_work_center_machines_id_fk" FOREIGN KEY ("assigned_machine_id") REFERENCES "public"."work_center_machines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_conflicts" ADD CONSTRAINT "planning_conflicts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_conflicts" ADD CONSTRAINT "planning_conflicts_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_conflicts" ADD CONSTRAINT "planning_conflicts_stage_id_process_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."process_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_conflicts" ADD CONSTRAINT "planning_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_scenarios" ADD CONSTRAINT "planning_scenarios_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_scenarios" ADD CONSTRAINT "planning_scenarios_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_scenarios" ADD CONSTRAINT "planning_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_template_id_process_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_parent_stage_id_process_stages_id_fk" FOREIGN KEY ("parent_stage_id") REFERENCES "public"."process_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_depends_on_stage_id_process_stages_id_fk" FOREIGN KEY ("depends_on_stage_id") REFERENCES "public"."process_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_required_skill_id_production_skills_id_fk" FOREIGN KEY ("required_skill_id") REFERENCES "public"."production_skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_skills" ADD CONSTRAINT "production_skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_materials" ADD CONSTRAINT "stage_materials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_materials" ADD CONSTRAINT "stage_materials_stage_id_process_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."process_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_materials" ADD CONSTRAINT "stage_materials_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_center_machines" ADD CONSTRAINT "work_center_machines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_center_machines" ADD CONSTRAINT "work_center_machines_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_center_machines" ADD CONSTRAINT "work_center_machines_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_center_shifts" ADD CONSTRAINT "work_center_shifts_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_process_template_id_process_templates_id_fk" FOREIGN KEY ("process_template_id") REFERENCES "public"."process_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
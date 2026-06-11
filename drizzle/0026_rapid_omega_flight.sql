ALTER TABLE "invoices" ADD COLUMN "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "subject" varchar(500);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "salesperson_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_type" varchar(10) DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_value" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_type" varchar(4);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "adjustment_label" varchar(60);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "adjustment_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "round_off_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_notes" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "terms_conditions" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "reference" varchar(100);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "subject" varchar(500);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "salesperson_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "discount_type" varchar(10) DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "discount_value" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "discount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "withholding_type" varchar(4);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "withholding_tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "withholding_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "adjustment_label" varchar(60);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "adjustment_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "round_off_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "customer_notes" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "terms_conditions" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_salesperson_employee_id_employees_id_fk" FOREIGN KEY ("salesperson_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_emp_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."emp_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_withholding_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("withholding_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_salesperson_employee_id_employees_id_fk" FOREIGN KEY ("salesperson_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_project_id_emp_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."emp_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_withholding_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("withholding_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;
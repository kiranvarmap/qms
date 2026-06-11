CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"salutation" varchar(20),
	"first_name" varchar(120),
	"last_name" varchar(120),
	"email" varchar(255),
	"work_phone" varchar(50),
	"mobile" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "customer_type" varchar(20) DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "salutation" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "first_name" varchar(120);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_name" varchar(120);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "display_name" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "work_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "mobile" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "customer_language" varchar(20) DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "gst_treatment" varchar(40);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "place_of_supply" varchar(10);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "gstin" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pan" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tax_preference" varchar(20) DEFAULT 'taxable' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "currency" varchar(3) DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "opening_balance_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "payment_terms_label" varchar(40) DEFAULT 'due_on_receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "enable_portal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reporting_tags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "documents" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
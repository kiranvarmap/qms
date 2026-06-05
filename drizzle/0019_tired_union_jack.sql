CREATE TYPE "public"."vendor_address_kind" AS ENUM('billing', 'shipping', 'remit');--> statement-breakpoint
CREATE TYPE "public"."vendor_doc_status" AS ENUM('valid', 'expiring', 'expired');--> statement-breakpoint
CREATE TABLE "vendor_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind" "vendor_address_kind" DEFAULT 'billing' NOT NULL,
	"line1" varchar(255),
	"line2" varchar(255),
	"city" varchar(120),
	"state" varchar(120),
	"country" varchar(2),
	"postal_code" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "vendor_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"account_name" varchar(255),
	"account_number" varchar(60),
	"bank_name" varchar(255),
	"branch" varchar(255),
	"routing" varchar(60),
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"doc_type" varchar(120) NOT NULL,
	"number" varchar(120),
	"issued_date" timestamp,
	"expiry_date" timestamp,
	"file_url" text,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"status" "vendor_doc_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"product_id" uuid,
	"vendor_sku" varchar(120),
	"description" varchar(255),
	"unit_price_minor" integer DEFAULT 0 NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"on_time_pct" real DEFAULT 0 NOT NULL,
	"quality_reject_pct" real DEFAULT 0 NOT NULL,
	"price_variance_pct" real DEFAULT 0 NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "approval_state" varchar(20) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_preferred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "on_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_addresses" ADD CONSTRAINT "vendor_addresses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_addresses" ADD CONSTRAINT "vendor_addresses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bank_accounts" ADD CONSTRAINT "vendor_bank_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bank_accounts" ADD CONSTRAINT "vendor_bank_accounts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_items" ADD CONSTRAINT "vendor_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_performance" ADD CONSTRAINT "vendor_performance_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_performance" ADD CONSTRAINT "vendor_performance_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
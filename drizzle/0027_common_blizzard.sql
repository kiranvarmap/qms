ALTER TABLE "vendor_contacts" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "salutation" varchar(20);--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "first_name" varchar(120);--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "last_name" varchar(120);--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "work_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "mobile" varchar(50);--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_type" varchar(20) DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "salutation" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "first_name" varchar(120);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "last_name" varchar(120);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "company_name" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "display_name" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "work_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "mobile" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_language" varchar(20) DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "gst_treatment" varchar(40);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "place_of_supply" varchar(10);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "gstin" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "pan" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "tax_preference" varchar(20) DEFAULT 'taxable' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "currency" varchar(3) DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "opening_balance_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "payment_terms_label" varchar(40) DEFAULT 'due_on_receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "billing_address" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shipping_address" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "reporting_tags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "documents_meta" jsonb DEFAULT '[]'::jsonb NOT NULL;
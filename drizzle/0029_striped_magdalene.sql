ALTER TABLE "purchase_orders" ADD COLUMN "reference" varchar(255);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "order_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "payment_terms_label" varchar(40) DEFAULT 'due_on_receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "shipment_preference" varchar(255);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "reverse_charge" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_address_type" varchar(20) DEFAULT 'organization' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_address" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "discount_type" varchar(10) DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "discount_value" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "discount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "withholding_type" varchar(10);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "withholding_tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "withholding_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "adjustment_label" varchar(60) DEFAULT 'Adjustment' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "adjustment_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "round_off_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "terms_conditions" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_customer_id_customers_id_fk" FOREIGN KEY ("delivery_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_withholding_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("withholding_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "expenses" ADD COLUMN "expense_account_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "paid_through_account_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "expense_type" varchar(20) DEFAULT 'goods' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "sac_code" varchar(60);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "gst_treatment" varchar(40);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "source_of_supply" varchar(10);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "destination_of_supply" varchar(10);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "reverse_charge" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "tax_inclusive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "invoice_number" varchar(120);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "reporting_tags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_account_id_ledger_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_through_account_id_ledger_accounts_id_fk" FOREIGN KEY ("paid_through_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;
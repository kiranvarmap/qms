CREATE TABLE "card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"posted_date" timestamp,
	"description" varchar(255),
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"last4" varchar(4),
	"status" varchar(20) DEFAULT 'unmatched' NOT NULL,
	"matched_expense_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"doc_number" varchar(50) NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"settled_minor" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"note" varchar(255),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_advances_ws_docnum_uq" UNIQUE("workspace_id","doc_number")
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "max_amount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "receipt_required_above_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "kind" varchar(20) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "mileage_distance" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "mileage_rate_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cost_centre" varchar(120);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "billable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "billed_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "policy_violation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "advance_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "card_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_billed_invoice_id_invoices_id_fk" FOREIGN KEY ("billed_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_advance_id_expense_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."expense_advances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_card_transaction_id_card_transactions_id_fk" FOREIGN KEY ("card_transaction_id") REFERENCES "public"."card_transactions"("id") ON DELETE set null ON UPDATE no action;
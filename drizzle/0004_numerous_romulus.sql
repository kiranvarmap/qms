CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "goods_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"po_line_item_id" uuid NOT NULL,
	"product_id" uuid,
	"quantity" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"doc_number" varchar(50) NOT NULL,
	"received_by" uuid,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"description" varchar(500) NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"qty_received" real DEFAULT 0 NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"line_tax_minor" integer DEFAULT 0 NOT NULL,
	"position" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"doc_number" varchar(50) NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"expected_date" timestamp,
	"notes" text,
	"board_id" uuid,
	"group_id" uuid,
	"item_id" uuid,
	"link_level" "link_level" DEFAULT 'none' NOT NULL,
	"created_by" uuid,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_ws_docnum_uq" UNIQUE("workspace_id","doc_number")
);
--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_po_line_item_id_po_line_items_id_fk" FOREIGN KEY ("po_line_item_id") REFERENCES "public"."po_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
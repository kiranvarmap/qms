CREATE TYPE "public"."cycle_count_status" AS ENUM('open', 'counted', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."location_kind" AS ENUM('zone', 'aisle', 'rack', 'shelf', 'bin');--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('available', 'quarantine', 'expired', 'scrapped');--> statement-breakpoint
CREATE TYPE "public"."serial_status" AS ENUM('in_stock', 'shipped', 'scrapped', 'quarantine');--> statement-breakpoint
CREATE TYPE "public"."valuation_method" AS ENUM('standard', 'average', 'fifo');--> statement-breakpoint
CREATE TABLE "cycle_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid,
	"system_qty" real DEFAULT 0 NOT NULL,
	"counted_qty" real,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"status" "cycle_count_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(255),
	"kind" "location_kind" DEFAULT 'bin' NOT NULL,
	"parent_location_id" uuid,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_wh_code_uq" UNIQUE("warehouse_id","code")
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_number" varchar(120) NOT NULL,
	"supplier_lot_number" varchar(120),
	"mfg_date" timestamp,
	"expiry_date" timestamp,
	"received_date" timestamp DEFAULT now() NOT NULL,
	"status" "lot_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lots_product_number_uq" UNIQUE("product_id","lot_number")
);
--> statement-breakpoint
CREATE TABLE "serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_number" varchar(120) NOT NULL,
	"lot_id" uuid,
	"warehouse_id" uuid,
	"status" serial_status DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "serials_product_number_uq" UNIQUE("product_id","serial_number")
);
--> statement-breakpoint
CREATE TABLE "valuation_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty_remaining" real DEFAULT 0 NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"ref_type" varchar(40),
	"ref_id" uuid
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" varchar(120);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tracks_lots" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tracks_serials" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shelf_life_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "valuation_method" "valuation_method" DEFAULT 'average' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD COLUMN "damaged" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD COLUMN "quarantine" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_cycle_count_id_cycle_counts_id_fk" FOREIGN KEY ("cycle_count_id") REFERENCES "public"."cycle_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layers" ADD CONSTRAINT "valuation_layers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layers" ADD CONSTRAINT "valuation_layers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layers" ADD CONSTRAINT "valuation_layers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
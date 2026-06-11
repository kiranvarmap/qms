ALTER TABLE "products" ADD COLUMN "qc_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qc_template_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_qc_template_id_inspection_templates_id_fk" FOREIGN KEY ("qc_template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE set null ON UPDATE no action;
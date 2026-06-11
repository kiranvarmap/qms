CREATE TABLE "stage_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"required_headcount" integer DEFAULT 1 NOT NULL,
	"min_level" "skill_level" DEFAULT 'qualified' NOT NULL,
	CONSTRAINT "stage_skills_uq" UNIQUE("stage_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "stage_skills" ADD CONSTRAINT "stage_skills_stage_id_process_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."process_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_skills" ADD CONSTRAINT "stage_skills_skill_id_production_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."production_skills"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_quest_id" uuid,
	"vibration" boolean DEFAULT false NOT NULL,
	"sound" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_active_quest_id_quests_id_fk" FOREIGN KEY ("active_quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;
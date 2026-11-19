ALTER TABLE "quests" ADD COLUMN "repeat_weekdays" smallint;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "repeat_start" date;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "repeat_end" date;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "scheduled_on" date;--> statement-breakpoint
CREATE UNIQUE INDEX "quests_contract_day_idx" ON "quests" USING btree ("parent_id","scheduled_on") WHERE "quests"."scheduled_on" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_contract_schedule" CHECK (num_nulls("quests"."repeat_weekdays", "quests"."repeat_start", "quests"."repeat_end") IN (0, 3)
        AND ("quests"."repeat_weekdays" IS NULL OR (
          "quests"."kind" = 'quest' AND "quests"."repeat_weekdays" BETWEEN 1 AND 127
          AND "quests"."repeat_end" >= "quests"."repeat_start" AND "quests"."repeat_end" - "quests"."repeat_start" <= 365)));--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_scheduled_only_step" CHECK ("quests"."scheduled_on" IS NULL OR "quests"."kind" = 'step');
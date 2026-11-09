CREATE TYPE "public"."quest_kind" AS ENUM('line', 'chapter', 'quest', 'step');--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('open', 'done', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"line_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" "quest_kind" NOT NULL,
	"status" "quest_status" DEFAULT 'open' NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text,
	"deadline" date,
	"position" text COLLATE "C" NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quests_line_has_no_parent" CHECK (("quests"."kind" = 'line') = ("quests"."parent_id" IS NULL)),
	CONSTRAINT "quests_pause_only_line_or_chapter" CHECK ("quests"."status" <> 'paused' OR "quests"."kind" IN ('line', 'chapter'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_parent_id_quests_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quests_line_idx" ON "quests" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "quests_children_idx" ON "quests" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "quests_journal_idx" ON "quests" USING btree ("user_id","kind","status");
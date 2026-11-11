ALTER TABLE "invites" ADD COLUMN "gender" text DEFAULT 'x' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "gender" text DEFAULT 'x' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text DEFAULT 'x' NOT NULL;
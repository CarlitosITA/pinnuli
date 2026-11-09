CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at_ms" bigint NOT NULL,
	"expires_at_ms" bigint NOT NULL,
	"used_at_ms" bigint
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_idx" ON "invites" USING btree ("token_hash");
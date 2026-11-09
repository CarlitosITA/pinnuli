CREATE TABLE "push_log" (
	"subscription_id" text NOT NULL,
	"group_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_sent_ms" bigint NOT NULL,
	CONSTRAINT "push_log_subscription_id_group_id_pk" PRIMARY KEY("subscription_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at_ms" bigint NOT NULL,
	"last_ok_ms" bigint,
	"failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_log" ADD CONSTRAINT "push_log_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_device_idx" ON "push_subscriptions" USING btree ("device_id");
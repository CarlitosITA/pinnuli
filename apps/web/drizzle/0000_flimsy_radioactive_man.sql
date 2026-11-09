CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"kind" text NOT NULL,
	"dose_key" text,
	"device_id" text,
	"step" integer DEFAULT 0 NOT NULL,
	"recipient_user_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"taken_over_by" text,
	"message" text DEFAULT '' NOT NULL,
	"created_at_ms" bigint NOT NULL,
	"resolved_at_ms" bigint,
	"delivered_via" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at_ms" bigint NOT NULL,
	"patient_id" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text,
	"kind" text DEFAULT 'tablet' NOT NULL,
	"name" text DEFAULT 'Tablet' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pairing_code" text,
	"pairing_expires_ms" bigint,
	"poll_secret_hash" text,
	"token_hash" text,
	"handoff_token" text,
	"last_seen_ms" bigint,
	"battery" integer,
	"charging" boolean,
	"audio_ok" boolean,
	"version" text,
	"clock_skew_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dose_events" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"dose_key" text NOT NULL,
	"type" text NOT NULL,
	"at_ms" bigint NOT NULL,
	"until_ms" bigint,
	"reason" text,
	"actor" text,
	"received_at_ms" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doses" (
	"key" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"day" text NOT NULL,
	"rule_id" text,
	"override_id" text,
	"medication_id" text NOT NULL,
	"quantity" numeric(6, 2) NOT NULL,
	"scheduled_at" bigint NOT NULL,
	"local_time" text NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"if_forgotten" text DEFAULT 'ask' NOT NULL,
	"change_note" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"distinguishing" text,
	"form" text DEFAULT 'compressa' NOT NULL,
	"strength" text,
	"color" text DEFAULT '#F2D36B' NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"if_forgotten" text DEFAULT 'ask' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_url" text,
	"stock" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"circle_id" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"chain_position" integer DEFAULT 0 NOT NULL,
	"telegram_chat_id" text,
	"telegram_link_code" text,
	"quiet_from" text,
	"quiet_to" text,
	"discreet" boolean DEFAULT false NOT NULL,
	CONSTRAINT "memberships_user_id_circle_id_pk" PRIMARY KEY("user_id","circle_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"name" text NOT NULL,
	"tz" text DEFAULT 'Europe/Rome' NOT NULL,
	"routine" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"pin" text DEFAULT '0000' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_overrides" (
	"patient_id" text NOT NULL,
	"day" text NOT NULL,
	"moment" text NOT NULL,
	"time" text NOT NULL,
	CONSTRAINT "routine_overrides_patient_id_day_moment_pk" PRIMARY KEY("patient_id","day","moment")
);
--> statement-breakpoint
CREATE TABLE "rule_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"kind" text NOT NULL,
	"from_day" text NOT NULL,
	"to_day" text NOT NULL,
	"target" jsonb NOT NULL,
	"quantity" numeric(6, 2),
	"time" text,
	"medication_id" text,
	"reason" text,
	"author_id" text,
	"created_at_ms" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"medication_id" text NOT NULL,
	"quantity" numeric(6, 2) DEFAULT 1 NOT NULL,
	"timing" jsonb NOT NULL,
	"days" jsonb NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wake_events" (
	"patient_id" text NOT NULL,
	"day" text NOT NULL,
	"at_ms" bigint NOT NULL,
	CONSTRAINT "wake_events_patient_id_day_pk" PRIMARY KEY("patient_id","day")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dose_events" ADD CONSTRAINT "dose_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doses" ADD CONSTRAINT "doses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_overrides" ADD CONSTRAINT "routine_overrides_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_overrides" ADD CONSTRAINT "rule_overrides_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wake_events" ADD CONSTRAINT "wake_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_patient_idx" ON "alerts" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "devices_patient_idx" ON "devices" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "devices_code_idx" ON "devices" USING btree ("pairing_code");--> statement-breakpoint
CREATE INDEX "dose_events_dose_idx" ON "dose_events" USING btree ("dose_key");--> statement-breakpoint
CREATE INDEX "dose_events_patient_idx" ON "dose_events" USING btree ("patient_id","at_ms");--> statement-breakpoint
CREATE INDEX "doses_patient_time_idx" ON "doses" USING btree ("patient_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "medications_patient_idx" ON "medications" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "rule_overrides_patient_idx" ON "rule_overrides" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "rules_patient_idx" ON "rules" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
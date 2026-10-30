CREATE TYPE "public"."app_locale" AS ENUM('en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."document_owner_type" AS ENUM('quote_request', 'shipment');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."milestone_code" AS ENUM('BOOKED', 'RECEIVED_AT_DEPOT', 'DEPARTED_ORIGIN', 'IN_TRANSIT', 'ARRIVED_DESTINATION_PORT', 'IN_CUSTOMS', 'CUSTOMS_CLEARED', 'READY_FOR_COLLECTION', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'ON_HOLD');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CUSTOMER', 'QUOTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."service_code" AS ENUM('parcels', 'barrels', 'air_freight', 'sea_freight', 'vehicle', 'commercial_cargo');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('BOOKED', 'IN_TRANSIT', 'AT_DESTINATION', 'DELIVERED', 'ON_HOLD', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'staff', 'admin');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"preferred_locale" "app_locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_len" CHECK (char_length(btrim("customers"."name")) between 1 and 120),
	CONSTRAINT "customers_email_format" CHECK (char_length("customers"."email") <= 254 and "customers"."email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	CONSTRAINT "customers_phone_len" CHECK ("customers"."phone" is null or char_length("customers"."phone") between 5 and 32)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "document_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_mime_allowed" CHECK ("documents"."mime" in ('application/pdf', 'image/jpeg', 'image/png')),
	CONSTRAINT "documents_size" CHECK ("documents"."size_bytes" > 0 and "documents"."size_bytes" <= 10485760),
	CONSTRAINT "documents_name_len" CHECK (char_length("documents"."original_name") between 1 and 255),
	CONSTRAINT "documents_key_len" CHECK (char_length("documents"."storage_key") between 1 and 512)
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template" text NOT NULL,
	"recipient" text NOT NULL,
	"locale" "app_locale" NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "email_status" DEFAULT 'PENDING' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_deliveries_error_len" CHECK ("email_deliveries"."error" is null or char_length("email_deliveries"."error") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_code" "service_code" NOT NULL,
	"origin_country" char(2) NOT NULL,
	"destination_country" char(2) NOT NULL,
	"destination_city" text,
	"items" jsonb NOT NULL,
	"notes" text,
	"status" "quote_status" DEFAULT 'SUBMITTED' NOT NULL,
	"locale" "app_locale" NOT NULL,
	"cancellation_reason" text,
	"idempotency_key" uuid,
	"submitted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_reference_format" CHECK ("quote_requests"."reference" ~ '^QR[A-Z2-7]{6}$'),
	CONSTRAINT "quote_requests_origin_format" CHECK ("quote_requests"."origin_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "quote_requests_destination_format" CHECK ("quote_requests"."destination_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "quote_requests_city_len" CHECK ("quote_requests"."destination_city" is null or char_length("quote_requests"."destination_city") <= 120),
	CONSTRAINT "quote_requests_notes_len" CHECK ("quote_requests"."notes" is null or char_length("quote_requests"."notes") <= 2000),
	CONSTRAINT "quote_requests_items_shape" CHECK (jsonb_typeof("quote_requests"."items") = 'array' and jsonb_array_length("quote_requests"."items") between 1 and 50 and octet_length("quote_requests"."items"::text) <= 32768),
	CONSTRAINT "quote_requests_cancellation_reason" CHECK (("quote_requests"."status" <> 'CANCELLED' or char_length(btrim(coalesce("quote_requests"."cancellation_reason", ''))) between 1 and 500))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_request_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"inclusions" text DEFAULT '' NOT NULL,
	"exclusions" text DEFAULT '' NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_amount_positive" CHECK ("quotes"."amount_minor" > 0 and "quotes"."amount_minor" < 1000000000000),
	CONSTRAINT "quotes_currency_allowed" CHECK ("quotes"."currency" in ('EUR', 'XAF')),
	CONSTRAINT "quotes_text_len" CHECK (char_length("quotes"."inclusions") <= 2000 and char_length("quotes"."exclusions") <= 2000),
	CONSTRAINT "quotes_valid_after_creation" CHECK ("quotes"."valid_until" > "quotes"."created_at")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"milestone_code" "milestone_code" NOT NULL,
	"location" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"note_en" text,
	"note_fr" text,
	"public" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_events_location_len" CHECK ("shipment_events"."location" is null or char_length("shipment_events"."location") <= 120),
	CONSTRAINT "shipment_events_notes_len" CHECK (coalesce(char_length("shipment_events"."note_en"), 0) <= 1000 and coalesce(char_length("shipment_events"."note_fr"), 0) <= 1000)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_code" "service_code" NOT NULL,
	"status" "shipment_status" DEFAULT 'BOOKED' NOT NULL,
	"eta_from" date,
	"eta_to" date,
	"eta_visible" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_reference_format" CHECK ("shipments"."reference" ~ '^ML[A-Z2-7]{10}$'),
	CONSTRAINT "shipments_eta_order" CHECK ("shipments"."eta_from" is null or "shipments"."eta_to" is null or "shipments"."eta_to" >= "shipments"."eta_from")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_quote_request_id_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_email_lower_idx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "documents_customer_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_key" ON "email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_deliveries_entity_idx" ON "email_deliveries" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_requests_reference_key" ON "quote_requests" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_requests_idempotency_key_key" ON "quote_requests" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "quote_requests_customer_idx" ON "quote_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quote_requests_status_created_idx" ON "quote_requests" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "quotes_request_idx" ON "quotes" USING btree ("quote_request_id");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_occurred_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_reference_key" ON "shipments" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_quote_key" ON "shipments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "shipments_customer_idx" ON "shipments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");
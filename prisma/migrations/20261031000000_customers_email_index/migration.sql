-- Replace the expression index lower(email) with a plain index that Prisma can
-- represent, and guarantee emails are stored in lower case (the application,
-- validation and the auth trigger already lower-case them).
-- Non-destructive: no data is dropped.
DROP INDEX IF EXISTS "public"."customers_email_lower_idx";
CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "public"."customers" USING btree ("email");
UPDATE "public"."customers" SET "email" = lower("email") WHERE "email" <> lower("email");
ALTER TABLE "public"."customers" DROP CONSTRAINT IF EXISTS "customers_email_lowercase";
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_email_lowercase" CHECK ("email" = lower("email"));

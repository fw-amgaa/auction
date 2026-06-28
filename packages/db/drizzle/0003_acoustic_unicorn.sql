CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'defaulted');--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "payment" "payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "permit_issued_at" timestamp with time zone;
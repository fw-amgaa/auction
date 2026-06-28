ALTER TABLE "categories" ADD COLUMN "latin_name" text;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "aimag" text;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_code_uniq" ON "categories" USING btree ("code");
-- Data migration: ensure the two category display names carry the full
-- "Алтайн угалз" / "Алтайн тэх" form (they drive the catalog/register select
-- options). Idempotent and safe — touches only the 2 category rows' name column,
-- never lots/bids/users. Redeploys skip the seed, so this guarantees the names
-- are correct on an environment first seeded with the short form.
UPDATE "categories" SET "name" = 'Алтайн угалз' WHERE "code" = 'ugalz';--> statement-breakpoint
UPDATE "categories" SET "name" = 'Алтайн тэх' WHERE "code" = 'tekh';

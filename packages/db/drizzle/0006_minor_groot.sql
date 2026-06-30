CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_pk" PRIMARY KEY("user_id","permission")
);
--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_permissions_user_idx" ON "user_permissions" USING btree ("user_id");--> statement-breakpoint
-- Backfill: grant every existing dashboard user (role = admin) all permissions,
-- so the new per-user permission gate does not lock them out on deploy.
-- Idempotent via the PK + ON CONFLICT.
INSERT INTO "user_permissions" ("user_id", "permission")
SELECT u.id, p.permission
FROM "users" u
CROSS JOIN (VALUES
	('live.view'),
	('kyc.review'),
	('users.view'),
	('users.create'),
	('users.edit'),
	('users.suspend'),
	('users.reset_credentials'),
	('limits.adjust'),
	('lots.view'),
	('lots.create'),
	('lots.edit'),
	('lots.cancel'),
	('lots.rerun'),
	('lots.delete'),
	('results.view'),
	('results.mark_paid'),
	('results.permit'),
	('results.default'),
	('results.export'),
	('audit.view'),
	('admins.manage')
) AS p("permission")
WHERE u.role = 'admin'
ON CONFLICT DO NOTHING;
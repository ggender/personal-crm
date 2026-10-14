-- Every contact and every group gets an owner (a user).
-- This migration CHANGES EXISTING DATA: the contacts and groups that are already in the database
-- are given to the user whose email is in the setting app.owner_email (the OWNER_EMAIL of .env;
-- scripts/migrate.ts passes it). That user is created here if he does not exist yet.
-- No row is deleted and no other column is touched: notes, keep-in-touch marks and the members of
-- groups stay as they are. If there is data but no valid owner email, the whole migration stops
-- and the database stays as it was.
ALTER TABLE "contacts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "user_id" uuid;--> statement-breakpoint
DO $$
DECLARE
	owner_email text := lower(btrim(coalesce(current_setting('app.owner_email', true), '')));
	owner_id uuid;
BEGIN
	-- An empty database needs no owner: users appear when they first log in.
	IF EXISTS (SELECT 1 FROM "contacts") OR EXISTS (SELECT 1 FROM "groups") THEN
		IF owner_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
			RAISE EXCEPTION 'OWNER_EMAIL is not set or is not an email address: existing contacts and groups need an owner';
		END IF;
		INSERT INTO "users" ("name", "email", "email_verified") VALUES ('', owner_email, false)
			ON CONFLICT ("email") DO NOTHING;
		SELECT "id" INTO owner_id FROM "users" WHERE "email" = owner_email;
		UPDATE "contacts" SET "user_id" = owner_id;
		UPDATE "groups" SET "user_id" = owner_id;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP INDEX "contacts_name_idx";--> statement-breakpoint
DROP INDEX "groups_name_lower_idx";--> statement-breakpoint
CREATE INDEX "contacts_user_id_name_idx" ON "contacts" USING btree ("user_id","name" collate "ru-x-icu");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_user_id_name_lower_idx" ON "groups" USING btree ("user_id",lower("name"));

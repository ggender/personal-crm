ALTER TABLE "contacts" ADD COLUMN "birth_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_date_check" CHECK (("contacts"."birth_day" is null and "contacts"."birth_month" is null and "contacts"."birth_year" is null) or ("contacts"."birth_day" is not null and "contacts"."birth_month" is not null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_month_check" CHECK ("contacts"."birth_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_day_check" CHECK ("contacts"."birth_day" between 1 and case when "contacts"."birth_month" = 2 then 29 when "contacts"."birth_month" in (4, 6, 9, 11) then 30 else 31 end);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_year_check" CHECK ("contacts"."birth_year" >= 1900);
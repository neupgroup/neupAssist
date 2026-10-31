ALTER TABLE "integrations"
    DROP CONSTRAINT "integrations_application_id_fkey";

DROP INDEX "integrations_application_id_idx";

ALTER TABLE "applications"
    DROP CONSTRAINT "applications_pkey";

ALTER TABLE "applications"
    ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "integrations"
    ADD COLUMN "application_id_uuid" UUID;

UPDATE "integrations" AS integration
SET "application_id_uuid" = application."id_uuid"
FROM "applications" AS application
WHERE application."id" = integration."application_id";

ALTER TABLE "integrations"
    DROP COLUMN "application_id";

ALTER TABLE "integrations"
    RENAME COLUMN "application_id_uuid" TO "application_id";

ALTER TABLE "integrations"
    ALTER COLUMN "application_id" SET NOT NULL;

ALTER TABLE "applications"
    DROP COLUMN "id";

ALTER TABLE "applications"
    RENAME COLUMN "id_uuid" TO "id";

ALTER TABLE "applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");

CREATE INDEX "integrations_application_id_idx" ON "integrations"("application_id");

ALTER TABLE "integrations"
    ADD CONSTRAINT "integrations_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

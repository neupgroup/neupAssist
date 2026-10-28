-- Create provider records for legacy model provider names that are not yet registered.
INSERT INTO "intelligence_provider" ("name", "code", "status")
SELECT DISTINCT ON (LOWER(TRIM(model."provider")))
    TRIM(model."provider"),
    REGEXP_REPLACE(LOWER(TRIM(model."provider")), '[^a-z0-9_-]+', '-', 'g'),
    'active'
FROM "intelligence_models" AS model
WHERE NOT EXISTS (
    SELECT 1 FROM "intelligence_provider" AS provider
    WHERE LOWER(TRIM(provider."name")) = LOWER(TRIM(model."provider"))
)
ORDER BY LOWER(TRIM(model."provider")), model."id";

ALTER TABLE "intelligence_models" ADD COLUMN "provider_id" INTEGER;

UPDATE "intelligence_models" AS model
SET "provider_id" = provider."id"
FROM "intelligence_provider" AS provider
WHERE LOWER(TRIM(provider."name")) = LOWER(TRIM(model."provider"));

ALTER TABLE "intelligence_models" ALTER COLUMN "provider_id" SET NOT NULL;
ALTER TABLE "intelligence_models" DROP COLUMN "provider";

CREATE INDEX "intelligence_models_provider_id_idx" ON "intelligence_models"("provider_id");
ALTER TABLE "intelligence_models"
ADD CONSTRAINT "intelligence_models_provider_id_fkey"
FOREIGN KEY ("provider_id") REFERENCES "intelligence_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "intelligence_keys" ADD COLUMN "model_id" INTEGER;

UPDATE "intelligence_keys" AS key
SET "model_id" = model."id"
FROM "intelligence_models" AS model
JOIN "intelligence_provider" AS provider ON provider."id" = model."provider_id"
WHERE key."model" IS NOT NULL
  AND LOWER(TRIM(key."model")) = LOWER(TRIM(model."model_name"))
  AND (
    LOWER(TRIM(key."provider")) = LOWER(TRIM(provider."name"))
    OR LOWER(TRIM(key."provider")) = LOWER(TRIM(provider."code"))
  );

ALTER TABLE "intelligence_keys" DROP COLUMN "model";
CREATE INDEX "intelligence_keys_model_id_idx" ON "intelligence_keys"("model_id");
ALTER TABLE "intelligence_keys"
ADD CONSTRAINT "intelligence_keys_model_id_fkey"
FOREIGN KEY ("model_id") REFERENCES "intelligence_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

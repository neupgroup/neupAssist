ALTER TABLE "intelligence_keys" ADD COLUMN "model" TEXT;

UPDATE "intelligence_keys" AS key
SET "model" = model."code"
FROM "intelligence_models" AS model
WHERE key."model_id" = model."id";

UPDATE "intelligence_keys" AS key
SET "model" = (
  SELECT model."code"
  FROM "intelligence_models" AS model
  JOIN "intelligence_provider" AS provider ON provider."id" = model."provider_id"
  WHERE LOWER(TRIM(key."provider")) IN (LOWER(TRIM(provider."name")), LOWER(TRIM(provider."code")))
  ORDER BY CASE WHEN LOWER(model."status") = 'active' THEN 0 ELSE 1 END, model."order_index", model."added_on"
  LIMIT 1
)
WHERE key."model_id" IS NULL
  AND key."model" IS NULL;

ALTER TABLE "intelligence_keys" DROP CONSTRAINT "intelligence_keys_model_id_fkey";
DROP INDEX "intelligence_keys_model_id_idx";
ALTER TABLE "intelligence_keys" DROP COLUMN "model_id";

DROP TABLE "intelligence_models";
DROP TABLE "intelligence_provider";

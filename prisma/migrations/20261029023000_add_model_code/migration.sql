ALTER TABLE "intelligence_models" ADD COLUMN "model_code" TEXT;

UPDATE "intelligence_models"
SET "model_code" = "model_name";

ALTER TABLE "intelligence_models" ALTER COLUMN "model_code" SET NOT NULL;

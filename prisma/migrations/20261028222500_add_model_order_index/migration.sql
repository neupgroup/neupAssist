ALTER TABLE "intelligence_models"
ADD COLUMN "order_index" INTEGER NOT NULL DEFAULT 0;

WITH ordered_models AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "added_on" ASC, "id" ASC) - 1 AS "position"
    FROM "intelligence_models"
)
UPDATE "intelligence_models" AS model
SET "order_index" = ordered_models."position"
FROM ordered_models
WHERE model."id" = ordered_models."id";

CREATE INDEX "intelligence_models_order_index_idx"
ON "intelligence_models"("order_index");

-- Rename the existing provider credentials table and preserve its data.
ALTER TABLE "intelligence_model" RENAME TO "intelligence_keys";
ALTER TABLE "intelligence_keys" RENAME CONSTRAINT "intelligence_model_pkey" TO "intelligence_keys_pkey";

-- Store available provider models and their pricing metadata.
CREATE TABLE "intelligence_models" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "cost_input" DECIMAL(20,8) NOT NULL,
    "cost_output" DECIMAL(20,8) NOT NULL,
    "status" TEXT NOT NULL,
    "added_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_models_pkey" PRIMARY KEY ("id")
);

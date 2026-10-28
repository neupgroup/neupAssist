-- Allow provider keys to have no balance cap.
ALTER TABLE "intelligence_model" ALTER COLUMN "balance" DROP NOT NULL;

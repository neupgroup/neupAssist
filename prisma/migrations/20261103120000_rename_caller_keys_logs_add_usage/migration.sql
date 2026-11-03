ALTER TABLE "api_keys" RENAME TO "caller_keys";
ALTER TABLE "callerLogs" RENAME TO "caller_logs";

CREATE TABLE "caller_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "callerkey_id" UUID NOT NULL,
    "input_token" INTEGER NOT NULL,
    "output_token" INTEGER NOT NULL,
    "cost" DECIMAL(18, 16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "caller_usage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "caller_usage_callerkey_id_fkey" FOREIGN KEY ("callerkey_id") REFERENCES "caller_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "caller_usage_callerkey_id_created_at_idx" ON "caller_usage"("callerkey_id", "created_at");

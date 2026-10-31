CREATE TABLE "callerLogs" (
    "id" SERIAL NOT NULL,
    "account_id" TEXT,
    "application_id" UUID,
    "log" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callerLogs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "callerLogs_account_id_timestamp_idx" ON "callerLogs"("account_id", "timestamp");
CREATE INDEX "callerLogs_application_id_timestamp_idx" ON "callerLogs"("application_id", "timestamp");

ALTER TABLE "callerLogs" ADD CONSTRAINT "callerLogs_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "callerLogs" ADD CONSTRAINT "callerLogs_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "endpoints" JSONB NOT NULL,
    "authMethod" TEXT NOT NULL,
    "moreDetails" TEXT,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integrations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "auth_info" VARCHAR(2048) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "addedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integrations_application_id_idx" ON "integrations"("application_id");
CREATE INDEX "integrations_account_id_idx" ON "integrations"("account_id");

ALTER TABLE "integrations"
    ADD CONSTRAINT "integrations_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integrations"
    ADD CONSTRAINT "integrations_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

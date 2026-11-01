-- Give existing rows new UUID primary keys while preserving their data.
ALTER TABLE "intelligence_keys" ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "intelligence_keys" DROP CONSTRAINT "intelligence_keys_pkey";
ALTER TABLE "intelligence_keys" DROP COLUMN "id";
ALTER TABLE "intelligence_keys" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "intelligence_keys" ADD CONSTRAINT "intelligence_keys_pkey" PRIMARY KEY ("id");

ALTER TABLE "messages" ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey";
ALTER TABLE "messages" DROP COLUMN "id";
ALTER TABLE "messages" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

ALTER TABLE "integrations" ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_pkey";
ALTER TABLE "integrations" DROP COLUMN "id";
ALTER TABLE "integrations" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");

ALTER TABLE "callerLogs" ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "callerLogs" DROP CONSTRAINT "callerLogs_pkey";
ALTER TABLE "callerLogs" DROP COLUMN "id";
ALTER TABLE "callerLogs" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "callerLogs" ADD CONSTRAINT "callerLogs_pkey" PRIMARY KEY ("id");

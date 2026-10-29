CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayImage" TEXT,
    "neupId" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chats" DROP CONSTRAINT IF EXISTS "chats_account_id_fkey";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sent_by_fkey";

ALTER TABLE "chats"
    ALTER COLUMN "account_id" TYPE TEXT USING "account_id"::TEXT;
ALTER TABLE "messages"
    ALTER COLUMN "sent_by" TYPE TEXT USING "sent_by"::TEXT;

INSERT INTO "accounts" ("id", "type", "displayName", "status")
SELECT legacy."id", 'unknown', 'Legacy account ' || legacy."id", 'legacy'
FROM (
    SELECT "account_id" AS "id" FROM "chats" WHERE "account_id" IS NOT NULL
    UNION
    SELECT "sent_by" AS "id" FROM "messages" WHERE "sent_by" IS NOT NULL
) AS legacy
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "chats"
    ADD CONSTRAINT "chats_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sent_by_fkey"
    FOREIGN KEY ("sent_by") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

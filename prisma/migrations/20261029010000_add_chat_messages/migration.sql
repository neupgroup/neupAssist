CREATE TYPE "ChatStatus" AS ENUM ('served', 'toserve', 'paused', 'completed');
CREATE TYPE "MessageType" AS ENUM ('intelligenceReply', 'userSent', 'notification');

ALTER TABLE "chats"
    DROP COLUMN "messages",
    DROP COLUMN "created_on",
    DROP COLUMN "updated_on",
    ADD COLUMN "account_id" INTEGER,
    ADD COLUMN "status" "ChatStatus" NOT NULL DEFAULT 'toserve',
    ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "chats" ALTER COLUMN "account_id" SET NOT NULL;
ALTER TABLE "chats" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "chats" ALTER COLUMN "lastUpdated" DROP DEFAULT;

CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "sent_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by" INTEGER,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_chat_id_sent_on_idx" ON "messages"("chat_id", "sent_on");
ALTER TABLE "messages"
ADD CONSTRAINT "messages_chat_id_fkey"
FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The account table is managed outside this Prisma schema and may be added later.
-- Add these foreign keys now only when that table exists in the target database.
DO $$
BEGIN
    IF to_regclass('public.account') IS NOT NULL THEN
        ALTER TABLE "chats"
        ADD CONSTRAINT "chats_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

        ALTER TABLE "messages"
        ADD CONSTRAINT "messages_sent_by_fkey"
        FOREIGN KEY ("sent_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

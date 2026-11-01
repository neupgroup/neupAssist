-- Preserve every existing chat and its messages while replacing integer chat IDs with UUIDs.
ALTER TABLE "chats" ADD COLUMN "id_uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "messages" ADD COLUMN "chat_id_uuid" UUID;

UPDATE "messages" AS message
SET "chat_id_uuid" = chat."id_uuid"
FROM "chats" AS chat
WHERE message."chat_id" = chat."id";

ALTER TABLE "messages" ALTER COLUMN "chat_id_uuid" SET NOT NULL;
ALTER TABLE "messages" DROP CONSTRAINT "messages_chat_id_fkey";
DROP INDEX "messages_chat_id_sent_on_idx";
ALTER TABLE "chats" DROP CONSTRAINT "chats_pkey";

ALTER TABLE "chats" DROP COLUMN "id";
ALTER TABLE "chats" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "chats" ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");

ALTER TABLE "messages" DROP COLUMN "chat_id";
ALTER TABLE "messages" RENAME COLUMN "chat_id_uuid" TO "chat_id";
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "messages_chat_id_sent_on_idx" ON "messages"("chat_id", "sent_on");

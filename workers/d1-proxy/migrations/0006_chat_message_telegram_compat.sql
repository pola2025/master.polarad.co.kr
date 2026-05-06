-- Polarad D1 Migration 0006: compatibility column for legacy chat message lookups

ALTER TABLE chat_messages
  ADD COLUMN telegram_message_id INTEGER;

UPDATE chat_messages
   SET telegram_message_id = (
     SELECT ctm.telegram_message_id
       FROM chat_telegram_messages ctm
      WHERE ctm.chat_message_id = chat_messages.id
      ORDER BY ctm.created_at DESC
      LIMIT 1
   )
 WHERE EXISTS (
   SELECT 1
     FROM chat_telegram_messages ctm
    WHERE ctm.chat_message_id = chat_messages.id
 );

CREATE INDEX IF NOT EXISTS idx_chat_messages_telegram_message_id
  ON chat_messages(telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_chat_telegram_messages_sync_insert
AFTER INSERT ON chat_telegram_messages
FOR EACH ROW
WHEN NEW.chat_message_id != ''
BEGIN
  UPDATE chat_messages
     SET telegram_message_id = NEW.telegram_message_id
   WHERE id = NEW.chat_message_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chat_telegram_messages_sync_update
AFTER UPDATE OF telegram_message_id, chat_message_id ON chat_telegram_messages
FOR EACH ROW
WHEN NEW.chat_message_id != ''
BEGIN
  UPDATE chat_messages
     SET telegram_message_id = NEW.telegram_message_id
   WHERE id = NEW.chat_message_id;
END;

-- Polarad D1 Migration 0005: Telegram group reply mapping for client chat

CREATE TABLE IF NOT EXISTS chat_telegram_messages (
  id                  TEXT    PRIMARY KEY,
  telegram_chat_id    TEXT    NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  room_id             TEXT    NOT NULL,
  request_id          TEXT    NOT NULL,
  chat_message_id     TEXT             DEFAULT '',
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_telegram_messages_request
  ON chat_telegram_messages(request_id);

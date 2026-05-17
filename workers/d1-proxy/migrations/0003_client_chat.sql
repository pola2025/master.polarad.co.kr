-- Polarad D1 Migration 0003: client chat rooms, messages, attachments

CREATE TABLE IF NOT EXISTS chat_rooms (
  id              TEXT    PRIMARY KEY,
  client_id       TEXT             DEFAULT '',
  slug            TEXT    NOT NULL UNIQUE,
  client_email    TEXT             DEFAULT '',
  client_name     TEXT             DEFAULT '',
  company         TEXT             DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'open',
  last_message_at TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_client_id_unique
  ON chat_rooms(client_id)
  WHERE client_id != '';
CREATE INDEX IF NOT EXISTS idx_chat_rooms_slug ON chat_rooms(slug);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at ON chat_rooms(last_message_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                 TEXT    PRIMARY KEY,
  room_id            TEXT    NOT NULL,
  sender_type        TEXT    NOT NULL,
  topic              TEXT             DEFAULT '',
  body               TEXT             DEFAULT '',
  attachment_id      TEXT             DEFAULT '',
  read_by_client_at  TEXT,
  read_by_admin_at   TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY(room_id) REFERENCES chat_rooms(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
  ON chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_admin_unread
  ON chat_messages(room_id, sender_type, read_by_admin_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_unread
  ON chat_messages(room_id, sender_type, read_by_client_at);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id             TEXT    PRIMARY KEY,
  room_id        TEXT    NOT NULL,
  message_id     TEXT    NOT NULL,
  r2_key         TEXT    NOT NULL,
  filename       TEXT    NOT NULL DEFAULT '',
  content_type   TEXT             DEFAULT '',
  size_bytes     INTEGER NOT NULL DEFAULT 0,
  uploaded_by    TEXT    NOT NULL DEFAULT '',
  downloaded_at  TEXT,
  deleted_at     TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY(room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY(message_id) REFERENCES chat_messages(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_room ON chat_attachments(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_deleted ON chat_attachments(deleted_at);

-- Polarad D1 Migration 0004: request-scoped client chat workflow

ALTER TABLE chat_messages ADD COLUMN request_id TEXT DEFAULT '';
ALTER TABLE chat_attachments ADD COLUMN request_id TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS chat_requests (
  id              TEXT    PRIMARY KEY,
  room_id         TEXT    NOT NULL,
  client_id       TEXT             DEFAULT '',
  topic           TEXT    NOT NULL DEFAULT '',
  title           TEXT    NOT NULL DEFAULT '',
  summary         TEXT             DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'draft',
  accepted_at     TEXT,
  completed_at    TEXT,
  last_message_at TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY(room_id) REFERENCES chat_rooms(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_requests_room_status_last
  ON chat_requests(room_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_requests_room_created
  ON chat_requests(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_request_items (
  id          TEXT    PRIMARY KEY,
  request_id  TEXT    NOT NULL,
  content     TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'todo',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  FOREIGN KEY(request_id) REFERENCES chat_requests(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_request_items_request_sort
  ON chat_request_items(request_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_chat_messages_request_created
  ON chat_messages(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_request
  ON chat_attachments(request_id);

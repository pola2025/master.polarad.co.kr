-- Polarad D1 Migration 0007: schedule management + external integration

CREATE TABLE IF NOT EXISTS schedules (
  id                 TEXT    PRIMARY KEY,
  date               TEXT    NOT NULL DEFAULT '',          -- YYYY-MM-DD
  start_time         TEXT    NOT NULL DEFAULT '',          -- HH:mm
  end_time           TEXT             DEFAULT '',          -- HH:mm
  company            TEXT    NOT NULL DEFAULT '',
  contact_name       TEXT             DEFAULT '',
  phone              TEXT             DEFAULT '',
  memo               TEXT             DEFAULT '',
  status             TEXT    NOT NULL DEFAULT 'scheduled', -- scheduled/in_progress/completed/cancelled
  reminder_minutes   INTEGER NOT NULL DEFAULT 30,
  reminder_enabled   INTEGER NOT NULL DEFAULT 1,
  reminder_sent_at   TEXT    NOT NULL DEFAULT '',
  google_event_id    TEXT             DEFAULT '',
  google_event_link  TEXT             DEFAULT '',
  source             TEXT    NOT NULL DEFAULT 'manual',    -- manual/external/import
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_date_time ON schedules(date DESC, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_company ON schedules(company);
CREATE INDEX IF NOT EXISTS idx_schedules_reminder_due
  ON schedules(date, start_time, reminder_sent_at, reminder_enabled, status);
CREATE INDEX IF NOT EXISTS idx_schedules_google_event_id ON schedules(google_event_id);

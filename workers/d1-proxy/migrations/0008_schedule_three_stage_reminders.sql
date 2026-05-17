-- Polarad D1 Migration 0008: fixed three-stage schedule Telegram reminders

ALTER TABLE schedules ADD COLUMN reminder_24h_sent_at TEXT NOT NULL DEFAULT '';
ALTER TABLE schedules ADD COLUMN reminder_1h_sent_at TEXT NOT NULL DEFAULT '';
ALTER TABLE schedules ADD COLUMN reminder_30m_sent_at TEXT NOT NULL DEFAULT '';

UPDATE schedules
   SET reminder_30m_sent_at = reminder_sent_at
 WHERE COALESCE(reminder_sent_at, '') <> ''
   AND COALESCE(reminder_30m_sent_at, '') = '';

CREATE INDEX IF NOT EXISTS idx_schedules_reminder_24h_due
  ON schedules(date, start_time, reminder_24h_sent_at, reminder_enabled, status);
CREATE INDEX IF NOT EXISTS idx_schedules_reminder_1h_due
  ON schedules(date, start_time, reminder_1h_sent_at, reminder_enabled, status);
CREATE INDEX IF NOT EXISTS idx_schedules_reminder_30m_due
  ON schedules(date, start_time, reminder_30m_sent_at, reminder_enabled, status);

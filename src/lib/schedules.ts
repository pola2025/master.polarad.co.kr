import { calendar_v3, google } from "googleapis";
import { d1All, d1First, d1Run, newId, nowIso } from "@/lib/d1-client";
import {
  FIXED_TELEGRAM_REMINDER_STAGES,
  addMinutesToTime,
  buildScheduleDateTime,
  formatReminderStageLabel,
  normalizeScheduleStatus,
  sanitizePhone,
  scheduleSummary,
  type ReminderStageKey,
  type ScheduleStatus,
} from "@/lib/schedule-utils";

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const GOOGLE_CALENDAR_TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || "Asia/Seoul";
const GOOGLE_CALENDAR_OFFSET = process.env.GOOGLE_CALENDAR_OFFSET || "+09:00";

export interface ScheduleRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  company: string;
  contact_name: string;
  phone: string;
  memo: string;
  status: string;
  reminder_minutes: number;
  reminder_enabled: number;
  reminder_sent_at: string;
  reminder_24h_sent_at?: string;
  reminder_1h_sent_at?: string;
  reminder_30m_sent_at?: string;
  google_event_id: string;
  google_event_link: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  company: string;
  contactName: string;
  phone: string;
  memo: string;
  status: ScheduleStatus;
  reminderMinutes: number;
  reminderEnabled: boolean;
  reminderSentAt: string;
  reminder24hSentAt: string;
  reminder1hSentAt: string;
  reminder30mSentAt: string;
  reminderStage?: ReminderStageKey;
  googleEventId: string;
  googleEventLink: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  date: string;
  startTime: string;
  endTime?: string;
  company: string;
  contactName?: string;
  phone?: string;
  memo?: string;
  status?: string;
  reminderMinutes?: number;
  reminderEnabled?: boolean;
  syncGoogle?: boolean;
  source?: string;
}

export function mapScheduleRow(row: ScheduleRow): ScheduleRecord {
  return {
    id: row.id,
    date: row.date || "",
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    company: row.company || "",
    contactName: row.contact_name || "",
    phone: row.phone || "",
    memo: row.memo || "",
    status: normalizeScheduleStatus(row.status),
    reminderMinutes: Number(row.reminder_minutes ?? 30),
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderSentAt: row.reminder_sent_at || "",
    reminder24hSentAt: row.reminder_24h_sent_at || "",
    reminder1hSentAt: row.reminder_1h_sent_at || "",
    reminder30mSentAt: row.reminder_30m_sent_at || "",
    googleEventId: row.google_event_id || "",
    googleEventLink: row.google_event_link || "",
    source: row.source || "manual",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function googleOAuthConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GMAIL_CLIENT_ID) &&
      (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET) &&
      (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN),
  );
}

function getCalendarClient() {
  if (!googleOAuthConfigured()) return null;
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GMAIL_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN,
  });
  return google.calendar({ version: "v3", auth });
}

function buildGoogleEvent(input: ScheduleInput) {
  const endTime = input.endTime || addMinutesToTime(input.startTime, 60);
  const description = [
    input.memo ? `메모: ${input.memo}` : "",
    input.phone ? `연락처: ${sanitizePhone(input.phone)}` : "",
    "",
    "master.polarad 일정관리에서 생성됨",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: scheduleSummary(input.company, input.contactName || ""),
    description,
    start: {
      dateTime: buildScheduleDateTime(input.date, input.startTime, GOOGLE_CALENDAR_OFFSET),
      timeZone: GOOGLE_CALENDAR_TIMEZONE,
    },
    end: {
      dateTime: buildScheduleDateTime(input.date, endTime, GOOGLE_CALENDAR_OFFSET),
      timeZone: GOOGLE_CALENDAR_TIMEZONE,
    },
    reminders: {
      useDefault: false,
      overrides: input.reminderEnabled === false
        ? []
        : FIXED_TELEGRAM_REMINDER_STAGES.map((stage) => ({ method: "popup" as const, minutes: stage.minutes })),
    },
  };
}

export async function syncScheduleToGoogle(
  input: ScheduleInput,
  googleEventId?: string,
): Promise<{ id: string; htmlLink: string } | null> {
  const calendar = getCalendarClient();
  if (!calendar) return null;
  const requestBody = buildGoogleEvent(input);
  if (googleEventId) {
    const res = await calendar.events.update({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: googleEventId,
      requestBody,
    });
    return { id: res.data.id || googleEventId, htmlLink: res.data.htmlLink || "" };
  }
  const res = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody,
  });
  return { id: res.data.id || "", htmlLink: res.data.htmlLink || "" };
}

export async function deleteGoogleEvent(googleEventId: string): Promise<void> {
  const calendar = getCalendarClient();
  if (!calendar || !googleEventId) return;
  await calendar.events.delete({ calendarId: GOOGLE_CALENDAR_ID, eventId: googleEventId });
}

function parseGoogleSummary(summary = ""): { company: string; contactName: string } {
  const bracket = summary.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracket) return { company: bracket[1].trim(), contactName: bracket[2].trim() };
  return { company: summary.trim() || "Google Calendar 일정", contactName: "" };
}

function extractDescriptionField(description: string | null | undefined, label: string): string {
  if (!description) return "";
  const line = description
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${label}:`));
  return line ? line.replace(`${label}:`, "").trim() : "";
}

interface TableInfoRow {
  name: string;
}

let scheduleSchemaReady = false;

async function ensureScheduleSchema(): Promise<void> {
  if (scheduleSchemaReady) return;

  const columns = await d1All<TableInfoRow>("PRAGMA table_info(schedules)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.size === 0) {
    await d1Run(
      `CREATE TABLE IF NOT EXISTS schedules (
        id                 TEXT    PRIMARY KEY,
        date               TEXT    NOT NULL DEFAULT '',
        start_time         TEXT    NOT NULL DEFAULT '',
        end_time           TEXT             DEFAULT '',
        company            TEXT    NOT NULL DEFAULT '',
        contact_name       TEXT             DEFAULT '',
        phone              TEXT             DEFAULT '',
        memo               TEXT             DEFAULT '',
        status             TEXT    NOT NULL DEFAULT 'scheduled',
        reminder_minutes   INTEGER NOT NULL DEFAULT 30,
        reminder_enabled   INTEGER NOT NULL DEFAULT 1,
        reminder_sent_at   TEXT    NOT NULL DEFAULT '',
        reminder_24h_sent_at TEXT  NOT NULL DEFAULT '',
        reminder_1h_sent_at  TEXT  NOT NULL DEFAULT '',
        reminder_30m_sent_at TEXT  NOT NULL DEFAULT '',
        google_event_id    TEXT             DEFAULT '',
        google_event_link  TEXT             DEFAULT '',
        source             TEXT    NOT NULL DEFAULT 'manual',
        created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      )`,
    );
    columnNames.add("reminder_24h_sent_at");
    columnNames.add("reminder_1h_sent_at");
    columnNames.add("reminder_30m_sent_at");
  }

  const reminderColumns: Array<[string, string]> = [
    ["reminder_24h_sent_at", "ALTER TABLE schedules ADD COLUMN reminder_24h_sent_at TEXT NOT NULL DEFAULT ''"],
    ["reminder_1h_sent_at", "ALTER TABLE schedules ADD COLUMN reminder_1h_sent_at TEXT NOT NULL DEFAULT ''"],
    ["reminder_30m_sent_at", "ALTER TABLE schedules ADD COLUMN reminder_30m_sent_at TEXT NOT NULL DEFAULT ''"],
  ];

  for (const [name, sql] of reminderColumns) {
    if (!columnNames.has(name)) {
      await d1Run(sql);
      columnNames.add(name);
    }
  }

  await d1Run(
    "UPDATE schedules SET reminder_30m_sent_at = reminder_sent_at WHERE COALESCE(reminder_sent_at, '') <> '' AND COALESCE(reminder_30m_sent_at, '') = ''",
  );

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_schedules_date_time ON schedules(date DESC, start_time DESC)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_company ON schedules(company)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_reminder_due ON schedules(date, start_time, reminder_sent_at, reminder_enabled, status)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_google_event_id ON schedules(google_event_id)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_reminder_24h_due ON schedules(date, start_time, reminder_24h_sent_at, reminder_enabled, status)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_reminder_1h_due ON schedules(date, start_time, reminder_1h_sent_at, reminder_enabled, status)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_reminder_30m_due ON schedules(date, start_time, reminder_30m_sent_at, reminder_enabled, status)",
  ];

  for (const sql of indexes) {
    await d1Run(sql);
  }

  scheduleSchemaReady = true;
}

function toKoreaDateTimeParts(value?: string | null, fallbackDate?: string | null): { date: string; time: string } {
  if (!value) return { date: fallbackDate || "", time: "00:00" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value.slice(0, 10), time: value.slice(11, 16) || "00:00" };
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: GOOGLE_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [datePart, timePart = "00:00"] = formatted.split(" ");
  return { date: datePart, time: timePart.slice(0, 5) };
}

async function listGoogleCalendarOnlySchedules(localSchedules: ScheduleRecord[]): Promise<ScheduleRecord[]> {
  const calendar = getCalendarClient();
  if (!calendar) return [];

  const knownEventIds = new Set(localSchedules.map((schedule) => schedule.googleEventId).filter(Boolean));
  const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  const res = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin,
    timeMax,
    maxResults: 250,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items || [])
    .filter((event): event is calendar_v3.Schema$Event => Boolean(event.id) && event.status !== "cancelled")
    .filter((event) => !knownEventIds.has(event.id || ""))
    .map((event) => {
      const start = event.start?.dateTime
        ? toKoreaDateTimeParts(event.start.dateTime)
        : { date: event.start?.date || "", time: "00:00" };
      const end = event.end?.dateTime
        ? toKoreaDateTimeParts(event.end.dateTime, start.date)
        : { date: event.end?.date || start.date, time: start.time };
      const parsed = parseGoogleSummary(event.summary || "");
      const description = event.description || "";
      const memoFromDescription = extractDescriptionField(description, "메모");
      const phoneFromDescription = extractDescriptionField(description, "연락처");

      return {
        id: `gcal_${event.id}`,
        date: start.date,
        startTime: start.time,
        endTime: end.time || start.time,
        company: parsed.company,
        contactName: parsed.contactName,
        phone: phoneFromDescription,
        memo: memoFromDescription || description.replace(/master\.polarad 일정관리에서 생성됨/g, "").trim(),
        status: "scheduled" as ScheduleStatus,
        reminderMinutes: 30,
        reminderEnabled: true,
        reminderSentAt: "",
        reminder24hSentAt: "",
        reminder1hSentAt: "",
        reminder30mSentAt: "",
        googleEventId: event.id || "",
        googleEventLink: event.htmlLink || "",
        source: "google_calendar",
        createdAt: event.created || "",
        updatedAt: event.updated || "",
      };
    });
}

export async function listSchedules(): Promise<ScheduleRecord[]> {
  await ensureScheduleSchema();
  const rows = await d1All<ScheduleRow>(
    `SELECT id, date, start_time, end_time, company, contact_name, phone, memo, status,
            reminder_minutes, reminder_enabled, reminder_sent_at,
            COALESCE(reminder_24h_sent_at, '') AS reminder_24h_sent_at,
            COALESCE(reminder_1h_sent_at, '') AS reminder_1h_sent_at,
            COALESCE(reminder_30m_sent_at, '') AS reminder_30m_sent_at,
            google_event_id, google_event_link, source, created_at, updated_at
       FROM schedules
      ORDER BY date DESC, start_time DESC
      LIMIT 500`,
  );
  const localSchedules = rows.map(mapScheduleRow);
  const calendarOnlySchedules = await listGoogleCalendarOnlySchedules(localSchedules).catch((err) => {
    console.error("[schedules] Google Calendar 목록 동기화 실패:", err);
    return [] as ScheduleRecord[];
  });

  return [...localSchedules, ...calendarOnlySchedules].sort((a, b) => {
    const aKey = `${a.date}T${a.startTime}`;
    const bKey = `${b.date}T${b.startTime}`;
    return aKey.localeCompare(bKey);
  });
}

export async function getSchedule(id: string): Promise<ScheduleRecord | null> {
  await ensureScheduleSchema();
  const row = await d1First<ScheduleRow>(
    `SELECT id, date, start_time, end_time, company, contact_name, phone, memo, status,
            reminder_minutes, reminder_enabled, reminder_sent_at,
            COALESCE(reminder_24h_sent_at, '') AS reminder_24h_sent_at,
            COALESCE(reminder_1h_sent_at, '') AS reminder_1h_sent_at,
            COALESCE(reminder_30m_sent_at, '') AS reminder_30m_sent_at,
            google_event_id, google_event_link, source, created_at, updated_at
       FROM schedules WHERE id = ?`,
    [id],
  );
  return row ? mapScheduleRow(row) : null;
}

export function validateScheduleInput(input: ScheduleInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))) return "날짜는 YYYY-MM-DD 형식이어야 합니다.";
  if (!/^\d{2}:\d{2}$/.test(String(input.startTime || ""))) return "시작 시간은 HH:mm 형식이어야 합니다.";
  if (input.endTime && !/^\d{2}:\d{2}$/.test(String(input.endTime))) return "종료 시간은 HH:mm 형식이어야 합니다.";
  if (!String(input.company || "").trim()) return "업체명은 필수입니다.";
  return null;
}

export async function createSchedule(input: ScheduleInput): Promise<ScheduleRecord> {
  const error = validateScheduleInput(input);
  if (error) throw new Error(error);
  await ensureScheduleSchema();
  const id = newId("sch");
  const now = nowIso();
  const endTime = input.endTime || addMinutesToTime(input.startTime, 60);
  let googleEventId = "";
  let googleEventLink = "";

  if (input.syncGoogle !== false) {
    const googleEvent = await syncScheduleToGoogle({ ...input, endTime }).catch((err) => {
      console.error("[schedules] Google Calendar 생성 실패:", err);
      return null;
    });
    googleEventId = googleEvent?.id || "";
    googleEventLink = googleEvent?.htmlLink || "";
  }

  await d1Run(
    `INSERT INTO schedules
      (id, date, start_time, end_time, company, contact_name, phone, memo, status,
       reminder_minutes, reminder_enabled, reminder_sent_at, google_event_id, google_event_link,
       source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
    [
      id,
      input.date,
      input.startTime,
      endTime,
      String(input.company || "").trim(),
      String(input.contactName || "").trim(),
      sanitizePhone(input.phone || ""),
      String(input.memo || "").trim(),
      normalizeScheduleStatus(input.status),
      Number(input.reminderMinutes ?? 30),
      input.reminderEnabled === false ? 0 : 1,
      googleEventId,
      googleEventLink,
      String(input.source || "manual"),
      now,
      now,
    ],
  );

  const created = await getSchedule(id);
  if (!created) throw new Error("일정 생성 후 조회 실패");
  return created;
}

export async function updateSchedule(id: string, input: Partial<ScheduleInput>): Promise<ScheduleRecord> {
  const existing = await getSchedule(id);
  if (!existing) throw new Error("일정을 찾을 수 없습니다.");
  const merged: ScheduleInput = {
    date: input.date ?? existing.date,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    company: input.company ?? existing.company,
    contactName: input.contactName ?? existing.contactName,
    phone: input.phone ?? existing.phone,
    memo: input.memo ?? existing.memo,
    status: input.status ?? existing.status,
    reminderMinutes: input.reminderMinutes ?? existing.reminderMinutes,
    reminderEnabled: input.reminderEnabled ?? existing.reminderEnabled,
    syncGoogle: input.syncGoogle,
    source: input.source ?? existing.source,
  };
  const error = validateScheduleInput(merged);
  if (error) throw new Error(error);

  let googleEventId = existing.googleEventId;
  let googleEventLink = existing.googleEventLink;
  if (input.syncGoogle !== false) {
    const googleEvent = await syncScheduleToGoogle(merged, existing.googleEventId || undefined).catch((err) => {
      console.error("[schedules] Google Calendar 동기화 실패:", err);
      return null;
    });
    googleEventId = googleEvent?.id || googleEventId;
    googleEventLink = googleEvent?.htmlLink || googleEventLink;
  }

  await d1Run(
    `UPDATE schedules
        SET date = ?, start_time = ?, end_time = ?, company = ?, contact_name = ?, phone = ?,
            memo = ?, status = ?, reminder_minutes = ?, reminder_enabled = ?,
            reminder_sent_at = '', reminder_24h_sent_at = '', reminder_1h_sent_at = '', reminder_30m_sent_at = '',
            google_event_id = ?, google_event_link = ?, source = ?, updated_at = ?
      WHERE id = ?`,
    [
      merged.date,
      merged.startTime,
      merged.endTime || addMinutesToTime(merged.startTime, 60),
      String(merged.company || "").trim(),
      String(merged.contactName || "").trim(),
      sanitizePhone(merged.phone || ""),
      String(merged.memo || "").trim(),
      normalizeScheduleStatus(merged.status),
      Number(merged.reminderMinutes ?? 30),
      merged.reminderEnabled === false ? 0 : 1,
      googleEventId,
      googleEventLink,
      String(merged.source || existing.source || "manual"),
      nowIso(),
      id,
    ],
  );

  const updated = await getSchedule(id);
  if (!updated) throw new Error("일정 수정 후 조회 실패");
  return updated;
}

export async function removeSchedule(id: string, deleteGoogle = true): Promise<void> {
  const existing = await getSchedule(id);
  if (!existing) throw new Error("일정을 찾을 수 없습니다.");
  if (deleteGoogle && existing.googleEventId) {
    await deleteGoogleEvent(existing.googleEventId).catch((err) => {
      console.error("[schedules] Google Calendar 삭제 실패:", err);
    });
  }
  await d1Run("DELETE FROM schedules WHERE id = ?", [id]);
}

function koreaLocalDateTime(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: GOOGLE_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return parts.replace(" ", "T");
}

function sentColumnForReminderStage(stage: ReminderStageKey): string {
  if (stage === "24h") return "reminder_24h_sent_at";
  if (stage === "1h") return "reminder_1h_sent_at";
  return "reminder_30m_sent_at";
}

function nextStageMinutes(stage: ReminderStageKey): number {
  if (stage === "24h") return 60;
  if (stage === "1h") return 30;
  return 0;
}

export async function dueReminderSchedules(now = new Date()): Promise<ScheduleRecord[]> {
  await ensureScheduleSchema();
  const nowIsoText = koreaLocalDateTime(now);
  const selects = FIXED_TELEGRAM_REMINDER_STAGES.map((stage) => {
    const sentColumn = sentColumnForReminderStage(stage.key);
    const nextMinutes = nextStageMinutes(stage.key);
    const windowEnd = nextMinutes > 0
      ? "datetime(date || 'T' || start_time || ':00', '-" + nextMinutes + " minutes') > datetime(?)"
      : "datetime(date || 'T' || start_time || ':00') >= datetime(?)";

    return "SELECT id, date, start_time, end_time, company, contact_name, phone, memo, status, " +
      "reminder_minutes, reminder_enabled, reminder_sent_at, " +
      "COALESCE(reminder_24h_sent_at, '') AS reminder_24h_sent_at, " +
      "COALESCE(reminder_1h_sent_at, '') AS reminder_1h_sent_at, " +
      "COALESCE(reminder_30m_sent_at, '') AS reminder_30m_sent_at, " +
      "google_event_id, google_event_link, source, created_at, updated_at, " +
      "'" + stage.key + "' AS reminder_stage " +
      "FROM schedules " +
      "WHERE reminder_enabled = 1 " +
      "AND COALESCE(" + sentColumn + ", '') = '' " +
      "AND status IN ('scheduled', 'in_progress') " +
      "AND datetime(date || 'T' || start_time || ':00', '-" + stage.minutes + " minutes') <= datetime(?) " +
      "AND " + windowEnd;
  });

  const rows = await d1All<ScheduleRow & { reminder_stage: ReminderStageKey }>(
    selects.join(" UNION ALL ") + " ORDER BY date ASC, start_time ASC LIMIT 30",
    FIXED_TELEGRAM_REMINDER_STAGES.flatMap(() => [nowIsoText, nowIsoText]),
  );
  return rows.map((row) => ({ ...mapScheduleRow(row), reminderStage: row.reminder_stage }));
}

export async function markReminderSent(id: string, stage?: ReminderStageKey): Promise<void> {
  await ensureScheduleSchema();
  const now = nowIso();
  if (!stage) {
    await d1Run("UPDATE schedules SET reminder_sent_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
    return;
  }

  const column = sentColumnForReminderStage(stage);
  const setLegacySentAt = stage === "30m" ? ", reminder_sent_at = ?" : "";
  const params = stage === "30m" ? [now, now, now, id] : [now, now, id];
  await d1Run("UPDATE schedules SET " + column + " = ?, updated_at = ?" + setLegacySentAt + " WHERE id = ?", params);
}

export async function sendScheduleTelegram(schedule: ScheduleRecord): Promise<boolean> {
  const token = process.env.SCHEDULE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.SCHEDULE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const stageLabel = schedule.reminderStage ? formatReminderStageLabel(schedule.reminderStage) : "알림";
  const msg = [
    "[schedule] 일정 " + stageLabel,
    "일시: " + schedule.date + " " + schedule.startTime,
    "업체: " + schedule.company,
    schedule.contactName ? "담당자: " + schedule.contactName : "",
    schedule.phone ? "연락처: " + schedule.phone : "",
    schedule.memo ? "메모: " + schedule.memo : "",
    schedule.googleEventLink ? "Google Calendar: " + schedule.googleEventLink : "",
    "",
    "https://master.polarad.co.kr/schedules",
  ].filter(Boolean).join("\n");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg, disable_web_page_preview: true }),
  });
  return res.ok;
}

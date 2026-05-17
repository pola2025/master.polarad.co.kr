export const SCHEDULE_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const FIXED_TELEGRAM_REMINDER_STAGES = [
  { key: "24h", minutes: 1440, label: "24시간 전" },
  { key: "1h", minutes: 60, label: "1시간 전" },
  { key: "30m", minutes: 30, label: "30분 전" },
] as const;

export type ReminderStageKey = (typeof FIXED_TELEGRAM_REMINDER_STAGES)[number]["key"];

export function formatReminderStageLabel(stageKey: ReminderStageKey): string {
  return FIXED_TELEGRAM_REMINDER_STAGES.find((stage) => stage.key === stageKey)?.label ?? "알림";
}

export function fixedTelegramReminderSummary(): string {
  return FIXED_TELEGRAM_REMINDER_STAGES.map((stage) => stage.label).join(" · ");
}

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

const STATUS_ALIASES: Record<string, ScheduleStatus> = {
  scheduled: "scheduled",
  todo: "scheduled",
  대기: "scheduled",
  예정: "scheduled",
  in_progress: "in_progress",
  progress: "in_progress",
  진행: "in_progress",
  진행중: "in_progress",
  completed: "completed",
  complete: "completed",
  done: "completed",
  완료: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  cancel: "cancelled",
  취소: "cancelled",
};

export function normalizeScheduleStatus(value: unknown): ScheduleStatus {
  const key = String(value || "scheduled").trim().toLowerCase();
  return STATUS_ALIASES[key] ?? "scheduled";
}

export function buildScheduleDateTime(
  date: string,
  time: string,
  timezone = "+09:00",
): string {
  const cleanDate = String(date || "").trim();
  const cleanTime = String(time || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    throw new Error("date는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (!/^\d{2}:\d{2}$/.test(cleanTime)) {
    throw new Error("time은 HH:mm 형식이어야 합니다.");
  }
  return `${cleanDate}T${cleanTime}:00${timezone}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function scheduleSummary(company: string, contactName: string): string {
  const left = String(company || "").trim() || "일정";
  const right = String(contactName || "").trim();
  return right ? `${left} - ${right}` : left;
}

export function sanitizePhone(phone: string): string {
  return String(phone || "").replace(/[^0-9+]/g, "").trim();
}

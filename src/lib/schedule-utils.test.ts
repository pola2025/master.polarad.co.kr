import {
  FIXED_TELEGRAM_REMINDER_STAGES,
  buildScheduleDateTime,
  formatReminderStageLabel,
  normalizeScheduleStatus,
} from "./schedule-utils";

const start = buildScheduleDateTime("2026-05-16", "09:30");
if (start !== "2026-05-16T09:30:00+09:00") throw new Error(start);
if (normalizeScheduleStatus("done") !== "completed") throw new Error("status");

const stageMinutes = FIXED_TELEGRAM_REMINDER_STAGES.map((stage) => stage.minutes).join(",");
if (stageMinutes !== "1440,60,30") throw new Error("unexpected fixed reminder stages: " + stageMinutes);

const stageLabels = FIXED_TELEGRAM_REMINDER_STAGES.map((stage) => formatReminderStageLabel(stage.key)).join(" /");
if (stageLabels !== "24시간 전 /1시간 전 /30분 전") throw new Error("unexpected fixed reminder stages: " + stageMinutes);

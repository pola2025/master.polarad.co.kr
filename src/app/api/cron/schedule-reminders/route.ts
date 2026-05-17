import { NextResponse } from "next/server";
import { dueReminderSchedules, markReminderSent, sendScheduleTelegram } from "@/lib/schedules";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targets = await dueReminderSchedules();
  const results = [];
  for (const schedule of targets) {
    const sent = await sendScheduleTelegram(schedule).catch((error) => {
      console.error("[schedule-reminders] 텔레그램 발송 실패:", error);
      return false;
    });
    if (sent) await markReminderSent(schedule.id, schedule.reminderStage);
    results.push({ id: schedule.id, company: schedule.company, stage: schedule.reminderStage, sent });
  }
  return NextResponse.json({ count: targets.length, results });
}

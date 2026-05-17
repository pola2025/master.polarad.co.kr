import { NextRequest, NextResponse } from "next/server";
import { createSchedule, listSchedules, updateSchedule } from "@/lib/schedules";

function authorized(request: NextRequest): boolean {
  const token = process.env.SCHEDULE_API_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}` || request.headers.get("x-schedule-api-token") === token;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schedules = await listSchedules();
  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const schedule = body.id
      ? await updateSchedule(String(body.id), { ...body, source: body.source || "external" })
      : await createSchedule({ ...body, source: body.source || "external" });
    return NextResponse.json({ schedule }, { status: body.id ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "일정 연동 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

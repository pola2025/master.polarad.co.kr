import { NextRequest, NextResponse } from "next/server";
import { createSchedule, listSchedules, removeSchedule, updateSchedule } from "@/lib/schedules";

export async function GET() {
  try {
    const schedules = await listSchedules();
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      schedules,
      stats: {
        total: schedules.length,
        today: schedules.filter((s) => s.date === today).length,
        upcoming: schedules.filter((s) => s.date >= today && s.status !== "cancelled" && s.status !== "completed").length,
        completed: schedules.filter((s) => s.status === "completed").length,
      },
    });
  } catch (error) {
    console.error("[schedules] 목록 조회 오류:", error);
    return NextResponse.json({ error: "일정 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schedule = await createSchedule({ ...body, source: body.source || "manual" });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "일정을 생성하지 못했습니다.";
    console.error("[schedules] 생성 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    const schedule = await updateSchedule(String(body.id), body);
    return NextResponse.json({ schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "일정을 수정하지 못했습니다.";
    console.error("[schedules] 수정 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, deleteGoogle } = await request.json();
    if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    await removeSchedule(String(id), deleteGoogle !== false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "일정을 삭제하지 못했습니다.";
    console.error("[schedules] 삭제 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

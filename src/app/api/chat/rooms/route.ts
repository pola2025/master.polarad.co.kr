import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { ensureRoomForClient, getChatRooms } from "@/lib/chat";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rooms = await getChatRooms();
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("[chat/rooms] 목록 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const room = await ensureRoomForClient({
      clientId: typeof body.clientId === "string" ? body.clientId : undefined,
      company: typeof body.company === "string" ? body.company.trim() : "",
      clientName:
        typeof body.clientName === "string" ? body.clientName.trim() : "",
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      email: typeof body.email === "string" ? body.email.trim() : "",
      industry: typeof body.industry === "string" ? body.industry.trim() : "",
    });

    return NextResponse.json({ room });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "채팅방 생성에 실패했습니다.";
    console.error("[chat/rooms] 생성 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

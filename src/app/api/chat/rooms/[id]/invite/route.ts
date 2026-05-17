import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getClientPhoneForRoom, getRoomById } from "@/lib/chat";
import { sendChatInvite, type ChatInviteChannel } from "@/lib/chat-invite";

function isInviteChannel(value: unknown): value is ChatInviteChannel {
  return value === "email" || value === "sms";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const room = await getRoomById(id);
    if (!room) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (room.status !== "open") {
      return NextResponse.json(
        { error: "닫힌 채팅방은 초대할 수 없습니다." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const channel = body.channel;
    if (!isInviteChannel(channel)) {
      return NextResponse.json(
        { error: "초대 방식을 선택해주세요." },
        { status: 400 },
      );
    }

    const phone =
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : await getClientPhoneForRoom(room);
    const result = await sendChatInvite({ room, channel, phone });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "초대 발송 실패" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat/rooms/invite] 오류:", error);
    return NextResponse.json({ error: "초대 발송 실패" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createTextMessage,
  getMessagesForRoom,
  getRequestById,
  getRoomById,
  markRoomRead,
} from "@/lib/chat";

export async function GET(
  _request: NextRequest,
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

    await markRoomRead(id, "admin");
    const messages = await getMessagesForRoom(id);
    return NextResponse.json({ room, messages });
  } catch (error) {
    console.error("[chat/messages] 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
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

    const body = await request.json();
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : "";
    if (!requestId) {
      return NextResponse.json(
        { error: "요청건을 선택해야 메시지를 보낼 수 있습니다." },
        { status: 400 },
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "메시지를 입력해주세요." },
        { status: 400 },
      );
    }
    const chatRequest = await getRequestById(requestId);
    if (!chatRequest || chatRequest.roomId !== id) {
      return NextResponse.json(
        { error: "요청건을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const message = await createTextMessage({
      roomId: id,
      requestId,
      senderType: "admin",
      topic: chatRequest.topic,
      body: text,
    });
    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "메시지 전송 실패";
    console.error("[chat/messages] 전송 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

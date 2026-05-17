import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createTextMessage,
  getMessagesForRequest,
  getRequestById,
  markRequestRead,
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
    const chatRequest = await getRequestById(id);
    if (!chatRequest) {
      return NextResponse.json(
        { error: "요청건을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    await markRequestRead(id, "admin");
    const messages = await getMessagesForRequest(id);
    return NextResponse.json({ request: chatRequest, messages });
  } catch (error) {
    console.error("[chat/request/messages] 조회 오류:", error);
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
    const chatRequest = await getRequestById(id);
    if (!chatRequest) {
      return NextResponse.json(
        { error: "요청건을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "메시지를 입력해주세요." },
        { status: 400 },
      );
    }

    const message = await createTextMessage({
      roomId: chatRequest.roomId,
      requestId: id,
      senderType: "admin",
      topic: chatRequest.topic,
      body: text,
    });
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메시지 전송 실패";
    console.error("[chat/request/messages] 전송 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  createTextMessage,
  getRequestById,
  getRoomById,
  isClosedChatRequest,
  notifyTelegramForClientMessage,
} from "@/lib/chat";
import { requireCustomerChatSession } from "@/lib/customer-chat-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const chatRequest = await getRequestById(id);
    if (!chatRequest) {
      return NextResponse.json(
        { error: "요청건을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const session = await requireCustomerChatSession(
      request,
      chatRequest.roomId,
    );
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const room = await getRoomById(chatRequest.roomId);
    if (!room || room.status !== "open") {
      return NextResponse.json(
        { error: "닫힌 채팅방입니다." },
        { status: 404 },
      );
    }
    if (isClosedChatRequest(chatRequest.status)) {
      return NextResponse.json(
        { error: "완료/취소된 요청건입니다." },
        { status: 409 },
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
      senderType: "client",
      topic: chatRequest.topic,
      body: text,
    });
    await notifyTelegramForClientMessage({
      room,
      request: chatRequest,
      message,
    });
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "메시지 전송 실패";
    console.error("[public/chat/request/messages] 전송 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

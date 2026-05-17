import { NextRequest, NextResponse } from "next/server";
import {
  getMessagesForRequest,
  getRequestById,
  getRoomById,
  markRequestRead,
} from "@/lib/chat";
import { requireCustomerChatSession } from "@/lib/customer-chat-auth";

export async function GET(
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

    await markRequestRead(id, "client");
    const [room, messages] = await Promise.all([
      getRoomById(chatRequest.roomId),
      getMessagesForRequest(id),
    ]);
    if (!room || room.status !== "open") {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json({ room, request: chatRequest, messages });
  } catch (error) {
    console.error("[public/chat/request] 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

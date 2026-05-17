import { NextRequest, NextResponse } from "next/server";
import {
  createRequestForRoom,
  getMessagesForRequest,
  getRequestsForRoom,
  getRoomBySlug,
  isChatTopic,
  isClosedChatRequest,
  markRequestRead,
  notifyTelegramForClientMessage,
} from "@/lib/chat";
import { requireCustomerChatSession } from "@/lib/customer-chat-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const room = await getRoomBySlug(slug);
    if (!room || room.status !== "open") {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const session = await requireCustomerChatSession(request, room.id);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const requests = await getRequestsForRoom(room.id);
    const preferredRequestId = request.nextUrl.searchParams.get("request") || "";
    const activeRequest =
      requests.find((item) => item.id === preferredRequestId) ||
      requests.find((item) => !isClosedChatRequest(item.status)) ||
      requests[0] ||
      null;
    if (activeRequest) {
      await markRequestRead(activeRequest.id, "client");
    }
    const messages = activeRequest
      ? await getMessagesForRequest(activeRequest.id)
      : [];

    return NextResponse.json({
      authenticated: true,
      room,
      requests,
      activeRequestId: activeRequest?.id || "",
      messages,
    });
  } catch (error) {
    console.error("[public/chat] 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const room = await getRoomBySlug(slug);
    if (!room || room.status !== "open") {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const session = await requireCustomerChatSession(request, room.id);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const topic = body.topic;
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!isChatTopic(topic)) {
      return NextResponse.json(
        { error: "요청 주제를 선택해주세요." },
        { status: 400 },
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "요청 내용을 입력해주세요." },
        { status: 400 },
      );
    }

    const result = await createRequestForRoom({
      roomId: room.id,
      clientId: room.clientId,
      topic,
      initialBody: text,
      senderType: "client",
    });
    if (result.message) {
      await notifyTelegramForClientMessage({
        room,
        request: result.request,
        message: result.message,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요청건 생성 실패";
    console.error("[public/chat] 요청건 생성 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

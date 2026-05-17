import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createRequestForRoom,
  getRequestsForRoom,
  getRoomById,
  isChatTopic,
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
    const requests = await getRequestsForRoom(id);
    return NextResponse.json({ room, requests });
  } catch (error) {
    console.error("[chat/room/requests] 조회 오류:", error);
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
    const body = await request.json();
    const topic = body.topic;
    if (!isChatTopic(topic)) {
      return NextResponse.json(
        { error: "요청 주제를 선택해주세요." },
        { status: 400 },
      );
    }

    const result = await createRequestForRoom({
      roomId: id,
      topic,
      title: typeof body.title === "string" ? body.title.trim() : "",
      initialBody:
        typeof body.body === "string" && body.body.trim()
          ? body.body.trim()
          : undefined,
      senderType: "admin",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요청건 생성 실패";
    console.error("[chat/room/requests] 생성 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

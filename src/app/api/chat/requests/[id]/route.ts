import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  getMessagesForRequest,
  getRequestById,
  getRoomById,
  isChatRequestStatus,
  markRequestRead,
  updateChatRequestAdmin,
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
    const [room, messages] = await Promise.all([
      getRoomById(chatRequest.roomId),
      getMessagesForRequest(id),
    ]);
    return NextResponse.json({ room, request: chatRequest, messages });
  } catch (error) {
    console.error("[chat/request] 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const status = body.status;
    if (status !== undefined && !isChatRequestStatus(status)) {
      return NextResponse.json(
        { error: "요청 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const items = Array.isArray(body.items)
      ? body.items.map((item: Record<string, unknown>) => ({
          id: typeof item.id === "string" ? item.id : undefined,
          content: typeof item.content === "string" ? item.content : "",
          status: item.status === "done" ? "done" : "todo",
        }))
      : undefined;

    const chatRequest = await updateChatRequestAdmin({
      requestId: id,
      title: typeof body.title === "string" ? body.title : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      status,
      items,
    });
    return NextResponse.json({ request: chatRequest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요청건 저장 실패";
    console.error("[chat/request] 저장 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getMessagesForRequest,
  getRequestsForRoom,
  getRoomBySlug,
  isClosedChatRequest,
  markRequestRead,
} from "@/lib/chat";
import {
  checkCustomerChatAuthRateLimit,
  getRequestIp,
  setCustomerChatCookie,
  verifyCustomerChatOtp,
} from "@/lib/customer-chat-auth";

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
    const allowed = await checkCustomerChatAuthRateLimit({
      roomId: room.id,
      ip: getRequestIp(request),
      action: "verify",
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "인증 시도가 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const result = await verifyCustomerChatOtp({ room, email, code });
    if (!result.valid || !result.token) {
      return NextResponse.json(
        { error: result.error || "인증 실패" },
        { status: 400 },
      );
    }

    const requests = await getRequestsForRoom(room.id);
    const activeRequest =
      requests.find((item) => !isClosedChatRequest(item.status)) ||
      requests[0] ||
      null;
    if (activeRequest) {
      await markRequestRead(activeRequest.id, "client");
    }
    const messages = activeRequest
      ? await getMessagesForRequest(activeRequest.id)
      : [];
    const response = NextResponse.json({
      ok: true,
      room,
      requests,
      activeRequestId: activeRequest?.id || "",
      messages,
    });
    setCustomerChatCookie(response, result.token);
    return response;
  } catch (error) {
    console.error("[public/chat/auth/verify] 오류:", error);
    return NextResponse.json({ error: "인증 실패" }, { status: 500 });
  }
}

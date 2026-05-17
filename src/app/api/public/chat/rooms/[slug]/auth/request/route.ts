import { NextRequest, NextResponse } from "next/server";
import { getRoomBySlug } from "@/lib/chat";
import {
  checkCustomerChatAuthRateLimit,
  getRequestIp,
  sendCustomerChatOtp,
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
      action: "request",
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "요청이 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const result = await sendCustomerChatOtp(room, email);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "인증번호 발송 실패" },
        { status: 429 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "등록된 이메일이면 인증번호가 발송됩니다.",
    });
  } catch (error) {
    console.error("[public/chat/auth/request] 오류:", error);
    return NextResponse.json(
      { error: "인증번호 발송 실패" },
      { status: 500 },
    );
  }
}

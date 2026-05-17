import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { archiveChatRoom, updateChatRoomClient } from "@/lib/chat";

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
    const room = await updateChatRoomClient({
      roomId: id,
      company: typeof body.company === "string" ? body.company : "",
      clientName: typeof body.clientName === "string" ? body.clientName : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      industry: typeof body.industry === "string" ? body.industry : "",
      slug: typeof body.slug === "string" ? body.slug : "",
    });
    return NextResponse.json({ room });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "거래처 수정 실패";
    console.error("[chat/rooms] 수정 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await archiveChatRoom(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "거래처 삭제 실패";
    console.error("[chat/rooms] 삭제 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

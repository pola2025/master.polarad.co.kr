import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getInboxMessage } from "@/lib/imap-mailbox";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "잘못된 메일 ID" }, { status: 400 });
    }
    const message = await getInboxMessage(id);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("[mail/inbox/id] 조회 실패:", error);
    return NextResponse.json(
      { error: "메일 상세 조회 실패" },
      { status: 500 },
    );
  }
}

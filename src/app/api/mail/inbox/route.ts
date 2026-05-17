import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getImapStatus, listInboxMessages } from "@/lib/imap-mailbox";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getImapStatus();
  if (!status.ready) {
    return NextResponse.json(
      { error: "IMAP 환경변수가 설정되지 않았습니다.", status },
      { status: 500 },
    );
  }

  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    const messages = await listInboxMessages(limit);
    return NextResponse.json({ messages, status });
  } catch (error) {
    console.error("[mail/inbox] 조회 실패:", error);
    return NextResponse.json(
      { error: "메일 수신함 조회 실패", status },
      { status: 500 },
    );
  }
}

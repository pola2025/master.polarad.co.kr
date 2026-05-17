import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { d1First, d1Run, nowIso } from "@/lib/d1-client";
import { formatContentDisposition } from "@/lib/chat";
import { deleteChatFileFromR2, getChatFileFromR2 } from "@/lib/r2-client";

interface AttachmentRow {
  id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  deleted_at: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const attachment = await d1First<AttachmentRow>(
      `SELECT id, r2_key, filename, content_type, size_bytes, deleted_at
         FROM chat_attachments WHERE id = ? LIMIT 1`,
      [id],
    );

    if (!attachment) {
      return NextResponse.json(
        { error: "첨부파일을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (attachment.deleted_at) {
      return NextResponse.json(
        { error: "이미 삭제된 첨부파일입니다." },
        { status: 410 },
      );
    }

    const file = await getChatFileFromR2(attachment.r2_key);
    const now = nowIso();
    await deleteChatFileFromR2(attachment.r2_key);
    await d1Run(
      `UPDATE chat_attachments
          SET downloaded_at = ?, deleted_at = ?
        WHERE id = ?`,
      [now, now, id],
    );

    return new NextResponse(file.data, {
      headers: {
        "Content-Type": attachment.content_type || file.contentType,
        "Content-Length": String(file.contentLength || attachment.size_bytes),
        "Content-Disposition": formatContentDisposition(attachment.filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[chat/attachments] 다운로드 오류:", error);
    return NextResponse.json({ error: "다운로드 실패" }, { status: 500 });
  }
}

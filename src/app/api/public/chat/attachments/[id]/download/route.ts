import { NextRequest, NextResponse } from "next/server";
import { d1First } from "@/lib/d1-client";
import { formatContentDisposition } from "@/lib/chat";
import { requireCustomerChatSession } from "@/lib/customer-chat-auth";
import { getChatFileFromR2 } from "@/lib/r2-client";

interface AttachmentRow {
  id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  deleted_at: string | null;
  room_id: string;
  slug: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const attachment = await d1First<AttachmentRow>(
      `SELECT a.id, a.r2_key, a.filename, a.content_type, a.size_bytes,
              a.deleted_at, a.room_id, r.slug
         FROM chat_attachments a
         JOIN chat_rooms r ON r.id = a.room_id
        WHERE a.id = ?
        LIMIT 1`,
      [id],
    );

    if (!attachment) {
      return NextResponse.json(
        { error: "첨부파일을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    const session = await requireCustomerChatSession(request, attachment.room_id);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (attachment.deleted_at) {
      return NextResponse.json(
        { error: "삭제된 첨부파일입니다." },
        { status: 410 },
      );
    }

    const file = await getChatFileFromR2(attachment.r2_key);
    return new NextResponse(file.data, {
      headers: {
        "Content-Type": attachment.content_type || file.contentType,
        "Content-Length": String(file.contentLength || attachment.size_bytes),
        "Content-Disposition": formatContentDisposition(attachment.filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[public/chat/attachments] 다운로드 오류:", error);
    return NextResponse.json({ error: "다운로드 실패" }, { status: 500 });
  }
}

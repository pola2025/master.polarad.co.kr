import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createAttachmentMessage,
  getRequestById,
  getRoomById,
  makeChatFileKey,
  MAX_CHAT_FILE_SIZE,
  sanitizeChatFilename,
} from "@/lib/chat";
import { newId } from "@/lib/d1-client";
import { deleteChatFileFromR2, putChatFileToR2 } from "@/lib/r2-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const room = await getRoomById(id);
  if (!room) {
    return NextResponse.json(
      { error: "채팅방을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  let r2Key = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bodyValue = formData.get("body");
    const requestIdValue = formData.get("requestId");
    const body = typeof bodyValue === "string" ? bodyValue.trim() : "";
    const requestId =
      typeof requestIdValue === "string" ? requestIdValue.trim() : "";

    if (!requestId) {
      return NextResponse.json(
        { error: "요청건을 선택해야 파일을 첨부할 수 있습니다." },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (file.size > MAX_CHAT_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 10MB 이하만 가능합니다." },
        { status: 400 },
      );
    }
    const chatRequest = await getRequestById(requestId);
    if (!chatRequest || chatRequest.roomId !== id) {
      return NextResponse.json(
        { error: "요청건을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const attachmentId = newId("att");
    const filename = sanitizeChatFilename(file.name);
    r2Key = makeChatFileKey({ roomId: id, attachmentId, filename });
    const bytes = await file.arrayBuffer();

    await putChatFileToR2({
      key: r2Key,
      bytes,
      contentType: file.type || "application/octet-stream",
      metadata: { filename, uploadedBy: "admin", roomId: id, requestId },
    });

    const message = await createAttachmentMessage({
      roomId: id,
      requestId,
      senderType: "admin",
      topic: chatRequest.topic,
      body,
      attachmentId,
      r2Key,
      filename,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (r2Key) {
      await deleteChatFileFromR2(r2Key).catch(() => {});
    }
    const message = error instanceof Error ? error.message : "업로드 실패";
    console.error("[chat/attachments] 업로드 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

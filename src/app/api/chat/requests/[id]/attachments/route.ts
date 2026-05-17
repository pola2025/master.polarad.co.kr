import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createAttachmentMessage,
  getRequestById,
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
  const chatRequest = await getRequestById(id);
  if (!chatRequest) {
    return NextResponse.json(
      { error: "요청건을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  let r2Key = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bodyValue = formData.get("body");
    const body = typeof bodyValue === "string" ? bodyValue.trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (file.size > MAX_CHAT_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 10MB 이하만 가능합니다." },
        { status: 400 },
      );
    }

    const attachmentId = newId("att");
    const filename = sanitizeChatFilename(file.name);
    r2Key = makeChatFileKey({
      roomId: chatRequest.roomId,
      attachmentId,
      filename,
    });
    const bytes = await file.arrayBuffer();

    await putChatFileToR2({
      key: r2Key,
      bytes,
      contentType: file.type || "application/octet-stream",
      metadata: {
        filename,
        uploadedBy: "admin",
        roomId: chatRequest.roomId,
        requestId: id,
      },
    });

    const message = await createAttachmentMessage({
      roomId: chatRequest.roomId,
      requestId: id,
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
    const message =
      error instanceof Error ? error.message : "업로드 실패";
    console.error("[chat/request/attachments] 업로드 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  createAttachmentMessage,
  createRequestForRoom,
  getRoomBySlug,
  isChatTopic,
  makeChatFileKey,
  MAX_CHAT_FILE_SIZE,
  notifyTelegramForClientMessage,
  sanitizeChatFilename,
} from "@/lib/chat";
import { requireCustomerChatSession } from "@/lib/customer-chat-auth";
import { newId } from "@/lib/d1-client";
import { deleteChatFileFromR2, putChatFileToR2 } from "@/lib/r2-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room || room.status !== "open") {
    return NextResponse.json(
      { error: "채팅방을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const session = await requireCustomerChatSession(request, room.id);
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let r2Key = "";
  try {
    const formData = await request.formData();
    const topicValue = formData.get("topic");
    const bodyValue = formData.get("body");
    const file = formData.get("file");
    const body = typeof bodyValue === "string" ? bodyValue.trim() : "";

    if (!isChatTopic(topicValue)) {
      return NextResponse.json(
        { error: "요청 주제를 선택해주세요." },
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

    const { request: chatRequest } = await createRequestForRoom({
      roomId: room.id,
      clientId: room.clientId,
      topic: topicValue,
      senderType: "client",
    });
    const attachmentId = newId("att");
    const filename = sanitizeChatFilename(file.name);
    r2Key = makeChatFileKey({ roomId: room.id, attachmentId, filename });
    const bytes = await file.arrayBuffer();
    await putChatFileToR2({
      key: r2Key,
      bytes,
      contentType: file.type || "application/octet-stream",
      metadata: {
        filename,
        uploadedBy: "client",
        roomId: room.id,
        requestId: chatRequest.id,
      },
    });

    const message = await createAttachmentMessage({
      roomId: room.id,
      requestId: chatRequest.id,
      senderType: "client",
      topic: topicValue,
      body,
      attachmentId,
      r2Key,
      filename,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });

    await notifyTelegramForClientMessage({ room, request: chatRequest, message });
    return NextResponse.json({ request: chatRequest, message });
  } catch (error) {
    if (r2Key) {
      await deleteChatFileFromR2(r2Key).catch(() => {});
    }
    const message = error instanceof Error ? error.message : "업로드 실패";
    console.error("[public/chat/attachments] 업로드 오류:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  createTextMessage,
  getRequestById,
  getRoomById,
  getTelegramChatLink,
  isClosedChatRequest,
  saveChatTelegramTarget,
  saveTelegramChatLink,
  sendTelegramChatMessage,
} from "@/lib/chat";

interface TelegramWebhookMessage {
  message_id?: number;
  text?: string;
  caption?: string;
  chat?: { id?: number | string };
  from?: { is_bot?: boolean };
  reply_to_message?: { message_id?: number };
}

interface TelegramWebhookUpdate {
  message?: TelegramWebhookMessage;
}

function webhookSecretValid(request: NextRequest): boolean {
  const secret = process.env.CHAT_TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
}

function configuredTelegramChatId(): string {
  return process.env.CHAT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
}

async function replyInTelegram(
  message: TelegramWebhookMessage,
  text: string,
): Promise<void> {
  if (typeof message.message_id !== "number" || message.chat?.id === undefined) {
    return;
  }
  await sendTelegramChatMessage({
    chatId: String(message.chat.id),
    text,
    replyToMessageId: message.message_id,
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  if (!webhookSecretValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramWebhookUpdate;
    const message = update.message;
    if (!message || message.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    const chatId =
      message.chat?.id === undefined ? "" : String(message.chat.id);
    const repliedMessageId = message.reply_to_message?.message_id;
    const messageId = message.message_id;
    const text = (message.text || message.caption || "").trim();
    if (text === "/chatid" || text.startsWith("/chatid@")) {
      const configuredChatId = configuredTelegramChatId();
      if (configuredChatId && chatId !== configuredChatId) {
        await replyInTelegram(
          message,
          "허용된 폴라애드 고객채팅 그룹이 아니라 알림 대상을 변경하지 않았습니다.",
        );
        return NextResponse.json({ ok: true });
      }
      await saveChatTelegramTarget(chatId);
      await replyInTelegram(
        message,
        `chat_id: ${chatId}\n폴라애드 고객채팅 알림 대상 그룹으로 저장했습니다.`,
      );
      return NextResponse.json({ ok: true });
    }

    if (!chatId || typeof repliedMessageId !== "number") {
      return NextResponse.json({ ok: true });
    }

    const link = await getTelegramChatLink(chatId, repliedMessageId);
    if (!link) {
      await replyInTelegram(
        message,
        "연결된 고객 요청건을 찾지 못했습니다. 최신 [chat] 알림에 답장해주세요.",
      );
      return NextResponse.json({ ok: true });
    }

    if (!text) {
      await replyInTelegram(
        message,
        "현재 텔레그램 답장은 텍스트만 고객 채팅으로 전송됩니다.",
      );
      return NextResponse.json({ ok: true });
    }

    const [chatRequest, room] = await Promise.all([
      getRequestById(link.request_id),
      getRoomById(link.room_id),
    ]);
    if (!chatRequest || !room || room.status !== "open") {
      await replyInTelegram(message, "닫힌 채팅방이라 고객에게 전송하지 않았습니다.");
      return NextResponse.json({ ok: true });
    }
    if (isClosedChatRequest(chatRequest.status)) {
      await replyInTelegram(message, "완료/취소된 요청건이라 고객에게 전송하지 않았습니다.");
      return NextResponse.json({ ok: true });
    }

    const chatMessage = await createTextMessage({
      roomId: room.id,
      requestId: chatRequest.id,
      senderType: "admin",
      topic: chatRequest.topic,
      body: text,
    });

    if (typeof messageId === "number") {
      await saveTelegramChatLink({
        telegramChatId: chatId,
        telegramMessageId: messageId,
        roomId: room.id,
        requestId: chatRequest.id,
        chatMessageId: chatMessage.id,
      });
    }

    await replyInTelegram(message, "고객 채팅으로 답장을 전송했습니다.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram-chat-webhook] 처리 오류:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

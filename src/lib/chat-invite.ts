import { sendHtmlMail } from "@/lib/mailer";
import { sendLMS } from "@/lib/ncp-sens";
import { escapeHtml } from "@/lib/html-escape";
import type { ChatRoom } from "@/lib/chat-shared";

export type ChatInviteChannel = "email" | "sms";

function inviteTitle(room: ChatRoom): string {
  return room.company || room.clientName || "고객";
}

function inviteEmailHtml(room: ChatRoom): string {
  const title = escapeHtml(inviteTitle(room));
  const chatUrl = escapeHtml(room.chatUrl);
  return `
    <div style="font-family:Arial,'Noto Sans KR',sans-serif;line-height:1.65;color:#111827">
      <h2 style="margin:0 0 12px">폴라애드 고객 채팅방 초대</h2>
      <p>${title}님, 폴라애드 요청 상담 채팅방이 열렸습니다.</p>
      <p>아래 링크로 접속한 뒤 등록된 이메일로 인증번호를 받아 입장해주세요.</p>
      <p style="margin:22px 0">
        <a href="${chatUrl}" target="_blank" rel="noreferrer" style="display:inline-block;border-radius:12px;background:#111827;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">채팅방 입장하기</a>
      </p>
      <p style="word-break:break-all;color:#374151">${chatUrl}</p>
      <p style="font-size:13px;color:#6b7280">보안을 위해 링크 접속 후 이메일 인증번호 확인이 필요합니다.</p>
    </div>
  `;
}

export async function sendChatInvite(input: {
  room: ChatRoom;
  channel: ChatInviteChannel;
  phone?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (input.channel === "email") {
    if (!input.room.clientEmail) {
      return { success: false, error: "거래처 이메일이 없습니다." };
    }
    await sendHtmlMail({
      to: input.room.clientEmail,
      subject: "[폴라애드] 고객 채팅방 초대",
      html: inviteEmailHtml(input.room),
    });
    return { success: true };
  }

  if (!input.phone) {
    return { success: false, error: "거래처 연락처가 없습니다." };
  }

  const result = await sendLMS(
    input.phone,
    `[폴라애드] 고객 채팅방이 열렸습니다.\n${input.room.chatUrl}\n접속 후 등록 이메일 인증번호로 입장해주세요.`,
    "폴라애드 채팅방 초대",
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error || "문자 발송 실패" };
}

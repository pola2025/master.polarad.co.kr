import { NextRequest, NextResponse } from "next/server";
import { d1First, d1Run, nowIso } from "@/lib/d1-client";

/**
 * 이메일 수신확인 트래킹 픽셀
 * GET /api/email-tracking/[id]?t=report|contract
 *
 * 1x1 투명 PNG를 반환하면서 D1 brand_reports에 열람 시각 기록 + 텔레그램 알림
 */

// 1x1 투명 PNG (68 bytes)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// rec ID 포맷 검증 (Airtable 시절 마이그된 ID + 신규 newId() 모두 동일 형식)
const VALID_ID = /^rec[a-zA-Z0-9]{14}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!VALID_ID.test(id)) {
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  const type = req.nextUrl.searchParams.get("t") || "report";

  // 비동기로 열람 기록 (응답 지연 없음)
  recordOpen(id, type).catch((err) =>
    console.error("[email-tracking] record error:", err),
  );

  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function recordOpen(id: string, type: string) {
  const now = nowIso();

  if (type === "report") {
    // 1. 기존 레코드 조회
    const record = await d1First<{
      business_name: string;
      contact_name: string;
      industry: string;
      sent_at: string | null;
      email_opened_at: string | null;
    }>(
      `SELECT business_name, contact_name, industry, sent_at, email_opened_at
       FROM brand_reports WHERE id = ?`,
      [id],
    );

    if (!record) {
      console.error("[email-tracking] Record not found:", id);
      return;
    }

    const alreadyOpened = !!record.email_opened_at;

    // 2. 최초 열람 시에만 D1 기록
    if (!alreadyOpened) {
      await d1Run(
        "UPDATE brand_reports SET email_opened_at = ?, updated_at = ? WHERE id = ?",
        [now, now, id],
      );

      console.log(`[email-tracking] Report ${id} first opened at ${now}`);

      // 3. 발송 완료된 건만 텔레그램 알림
      if (record.sent_at) {
        await notifyTelegram({
          businessName: record.business_name || "알 수 없음",
          contactName: record.contact_name || "",
          industry: record.industry || "",
          sentAt: record.sent_at,
          openedAt: now,
        });
      }
    } else {
      console.log(`[email-tracking] Report ${id} re-opened (skipped)`);
    }
  }
}

async function notifyTelegram(info: {
  businessName: string;
  contactName: string;
  industry: string;
  sentAt: string;
  openedAt: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LEAD_CHAT_ID;
  if (!botToken || !chatId) return;

  let elapsed = "";
  if (info.sentAt) {
    const sent = new Date(info.sentAt).getTime();
    const opened = new Date(info.openedAt).getTime();
    const diffMin = Math.floor((opened - sent) / 60000);
    if (diffMin < 60) {
      elapsed = `${diffMin}분`;
    } else if (diffMin < 1440) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      elapsed = m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
    } else {
      const d = Math.floor(diffMin / 1440);
      const h = Math.floor((diffMin % 1440) / 60);
      elapsed = h > 0 ? `${d}일 ${h}시간` : `${d}일`;
    }
  }

  const openedKST = new Date(info.openedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = [
    `[email-tracking] ✉️ <b>수신확인</b>`,
    `<b>${info.businessName}</b>${info.contactName ? ` (${info.contactName})` : ""}`,
    info.industry ? `업종: ${info.industry}` : "",
    `열람: ${openedKST}`,
    elapsed ? `발송 → 열람: ${elapsed}` : "",
  ].filter(Boolean);

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
      }),
    });
    console.log(
      `[email-tracking] Telegram notification sent for ${info.businessName}`,
    );
  } catch (e) {
    console.error("[email-tracking] Telegram notification failed:", e);
  }
}

import { NextRequest, NextResponse } from "next/server";

/**
 * 이메일 수신확인 트래킹 픽셀
 * GET /api/email-tracking/[id]?t=report|contract
 *
 * 1x1 투명 PNG를 반환하면서 Airtable에 열람 시각을 기록 + 텔레그램 알림
 */

// 1x1 투명 PNG (68 bytes)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const now = new Date().toISOString();

  if (type === "report") {
    const token = process.env.AIRTABLE_API_TOKEN;
    const baseId = process.env.BRAND_REPORT_BASE_ID;
    const tableId = process.env.BRAND_REPORT_TABLE_ID;

    if (!token || !baseId || !tableId) return;

    // 1. 기존 레코드 조회 (중복 알림 방지 + 리포트 정보)
    const getRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!getRes.ok) {
      console.error("[email-tracking] Record not found:", id);
      return;
    }

    const record = await getRes.json();
    const fields = record.fields as Record<string, string>;
    const alreadyOpened = !!fields.emailOpenedAt;

    // 2. 최초 열람 시에만 Airtable 기록 (재열람 시 덮어쓰지 않음)
    if (!alreadyOpened) {
      await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: { emailOpenedAt: now },
        }),
      });

      console.log(`[email-tracking] Report ${id} first opened at ${now}`);

      // 3. 발송 완료된 건만 텔레그램 알림 (미발송 건 오알림 방지)
      if (fields.sentAt) {
        await notifyTelegram({
          businessName: fields.businessName || "알 수 없음",
          contactName: fields.contactName || "",
          industry: fields.industry || "",
          sentAt: fields.sentAt,
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

  // 발송~열람 소요시간 계산
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
    `\u2709\uFE0F <b>\uC218\uC2E0\uD655\uC778</b>`,
    `<b>${info.businessName}</b>${info.contactName ? ` (${info.contactName})` : ""}`,
    info.industry ? `\uC5C5\uC885: ${info.industry}` : "",
    `\uC5F4\uB78C: ${openedKST}`,
    elapsed ? `\uBC1C\uC1A1 \u2192 \uC5F4\uB78C: ${elapsed}` : "",
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

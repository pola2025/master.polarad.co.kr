import { NextResponse } from "next/server";
import { sendLMS } from "@/lib/ncp-sens";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN!;
const META_BASE_ID = "appyUK6euzEJ5yrGX";
const META_TABLE_ID = "tblxTgGtVkLpniFbb";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_LEAD_CHAT_ID = process.env.TELEGRAM_LEAD_CHAT_ID;

async function notifyTelegram(name: string, phone: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEAD_CHAT_ID) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_LEAD_CHAT_ID,
          text: `📩 새 광고문의 접수\n이름: ${name}\n연락처: ${phone}`,
          parse_mode: "HTML",
        }),
      },
    );
  } catch (e) {
    console.error("텔레그램 접수 알림 실패:", e);
  }
}

const SMS_MESSAGE = `안녕하세요.

광고 문의를 주셔서 감사합니다.

상담가능시간 남겨주시면
연락드리겠습니다.

상담가능시간
AM 09:00 - PM 08:00

홈페이지: https://polarad.co.kr

감사합니다.`;

function formatPhone(phone: string): string {
  // 공백, 하이픈, 괄호 등 모든 비숫자 제거 (+ 제외)
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+82")) {
    cleaned = "0" + cleaned.slice(3);
  }
  return cleaned.replace(/\D/g, "");
}

/**
 * Meta 리드 Airtable에서 SMS 미발송 건을 찾아 자동 발송
 * Vercel Cron: 5분마다 실행
 */
export async function GET(request: Request) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // SMS 미발송 건 조회 (smsStatus가 비어있는 레코드)
    const url = new URL(
      `https://api.airtable.com/v0/${META_BASE_ID}/${META_TABLE_ID}`,
    );
    url.searchParams.set(
      "filterByFormula",
      "AND({phone} != '', OR({smsStatus} = '', {smsStatus} = BLANK()))",
    );
    url.searchParams.set("maxRecords", "10");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable 조회 실패:", err);
      return NextResponse.json(
        { error: "Airtable 조회 실패" },
        { status: 500 },
      );
    }

    const data = await res.json();
    const records = data.records || [];

    if (records.length === 0) {
      return NextResponse.json({ message: "발송 대상 없음", sent: 0 });
    }

    const results = [];

    for (const record of records) {
      const phone = record.fields.phone;
      const name = record.fields.Name || "";
      if (!phone) continue;

      const cleanPhone = formatPhone(phone);
      console.log(
        `SMS 발송 시도: ${name} | 원본: ${phone} | 변환: ${cleanPhone}`,
      );
      const smsResult = await sendLMS(cleanPhone, SMS_MESSAGE);

      // 접수 알림 텔레그램 전송
      if (smsResult.success) {
        await notifyTelegram(name, cleanPhone);
      }

      // Airtable에 발송 결과 기록
      const updateRes = await fetch(
        `https://api.airtable.com/v0/${META_BASE_ID}/${META_TABLE_ID}/${record.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              smsStatus: smsResult.success ? "발송완료" : "발송실패",
              smsError: smsResult.error || "",
              smsSentAt: new Date().toISOString(),
            },
          }),
        },
      );

      if (!updateRes.ok) {
        console.error("Airtable 상태 업데이트 실패:", await updateRes.text());
      }

      results.push({
        name,
        phone: cleanPhone,
        success: smsResult.success,
        error: smsResult.error,
      });
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`SMS 발송 완료: 성공 ${sent}, 실패 ${failed}`);

    return NextResponse.json({ sent, failed, results });
  } catch (error) {
    console.error("리드 SMS 발송 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

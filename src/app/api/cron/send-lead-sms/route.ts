import { NextResponse } from "next/server";
import { sendLMS } from "@/lib/ncp-sens";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN!;
const META_BASE_ID = "appyUK6euzEJ5yrGX";
const META_TABLE_ID = "tblxTgGtVkLpniFbb";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_LEAD_CHAT_ID = "-1003280236380";

async function notifyTelegram(name: string, phone: string, smsOk?: boolean) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEAD_CHAT_ID) {
    console.error(
      "텔레그램 환경변수 누락 - botToken:",
      !!TELEGRAM_BOT_TOKEN,
      "chatId:",
      !!TELEGRAM_LEAD_CHAT_ID,
    );
    return;
  }
  try {
    const smsTag = smsOk === undefined ? "-" : smsOk ? "발송완료" : "발송실패";
    const msg = [
      "[cron/send-lead-sms] 🔔 폴라애드 - 신규 상담 신청",
      "🔵 Meta 광고 (cron)",
      "",
      "👤 고객정보",
      `├ 이름: ${name}`,
      `└ 연락처: ${phone}`,
      "",
      `📱 SMS: ${smsTag}`,
      "",
      '<a href="https://master.polarad.co.kr/inquiries">📋 접수 확인</a>',
    ].join("\n");
    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_LEAD_CHAT_ID,
          text: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("텔레그램 API 응답 에러:", tgRes.status, err);
    } else {
      console.log("텔레그램 알림 발송 성공:", name);
    }
  } catch (e) {
    console.error("텔레그램 접수 알림 실패:", e);
  }
}

const SMS_MESSAGE = `안녕하세요.
상담신청이 접수되었습니다.

상담 가능시간 남겨주시면
연락드리겠습니다.

상담시간 평일
오전09:00-18:00

홈페이지
polarad.co.kr`;

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
  // Vercel Cron 인증 (필수)
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET 환경변수 미설정");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
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

      // 접수 알림 텔레그램 전송 (SMS 성공 여부와 무관하게 항상 발송)
      await notifyTelegram(name, cleanPhone, smsResult.success);

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

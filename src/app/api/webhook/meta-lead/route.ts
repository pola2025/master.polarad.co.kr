import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendLMS } from "@/lib/ncp-sens";
import { addToBlacklist, isBlacklisted } from "@/lib/blacklist";
import { d1Run, newId, nowIso } from "@/lib/d1-client";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_LEAD_CHAT_ID = "-1003280236380";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const SMS_MESSAGE = `안녕하세요.
상담신청이 접수되었습니다.

상담 가능시간 남겨주시면
연락드리겠습니다.

상담시간 평일
오전09:00-18:00

홈페이지
polarad.co.kr`;

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+82")) {
    cleaned = "0" + cleaned.slice(3);
  }
  return cleaned.replace(/\D/g, "");
}

async function sendTelegram(
  name: string,
  phone: string,
  company: string,
  industry: string,
  smsOk: boolean,
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEAD_CHAT_ID) {
    console.error("텔레그램 환경변수 누락");
    return;
  }
  try {
    const smsTag = smsOk ? "발송완료" : "발송실패";
    const msg = [
      "[webhook/meta-lead] 🔔 폴라애드 - 신규 상담 신청",
      "🔵 Meta 광고",
      "",
      "👤 고객정보",
      `├ 이름: ${name}`,
      `├ 회사명: ${company || "-"}`,
      `├ 연락처: ${phone}`,
      `└ 업종: ${industry || "-"}`,
      "",
      `📱 SMS: ${smsTag}`,
      "",
      '<a href="https://master.polarad.co.kr/inquiries">📋 접수 확인</a>',
    ].join("\n");
    const res = await fetch(
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
    if (!res.ok) {
      console.error("텔레그램 에러:", res.status, await res.text());
    }
  } catch (e) {
    console.error("텔레그램 실패:", e);
  }
}

async function sendTelegramBlacklist(name: string, phone: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEAD_CHAT_ID) return;
  try {
    const msg = `⚫ [webhook/meta-lead] 블랙리스트 사용자 접수\n${name || "-"} ${phone}`;
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_LEAD_CHAT_ID,
          text: msg,
          disable_web_page_preview: true,
        }),
      },
    );
  } catch (e) {
    console.error("텔레그램 블랙리스트 알림 실패:", e);
  }
}

async function sendTelegramError(error: string, ip: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEAD_CHAT_ID) return;
  try {
    const msg = [
      "[webhook/meta-lead] 🛡️ Webhook 공격 차단",
      `IP: ${ip}`,
      `에러: ${error.slice(0, 200)}`,
      `시각: ${new Date().toISOString()}`,
    ].join("\n");
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_LEAD_CHAT_ID,
          text: msg,
          disable_web_page_preview: true,
        }),
      },
    );
  } catch {}
}

/**
 * Make(Integromat)에서 호출하는 Meta Lead 접수 webhook
 * POST body: { name, phone, company?, industry?, adName?, secret? }
 * → D1 meta_lead 저장 + SMS 발송 + 텔레그램 알림
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Content-Type 검증 — JSON이 아니면 즉시 차단
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    console.warn(`[webhook] 잘못된 Content-Type (IP: ${ip}): ${contentType}`);
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[webhook] JSON 파싱 실패 (IP: ${ip}):`, parseError);
      await sendTelegramError(`JSON 파싱 실패: ${String(parseError)}`, ip);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // webhook 인증 — secret 필수
    if (!WEBHOOK_SECRET) {
      console.error("[webhook] WEBHOOK_SECRET 환경변수 미설정");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }
    const bodySecret = String(body.secret || "");
    if (
      bodySecret.length !== WEBHOOK_SECRET.length ||
      !timingSafeEqual(Buffer.from(bodySecret), Buffer.from(WEBHOOK_SECRET))
    ) {
      console.warn(`[webhook] 인증 실패 (IP: ${ip})`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const name = String(body.name || "");
    const phone = String(body.phone || "");
    const company = String(body.company || "");
    const industry = String(body.industry || "");
    const adName = String(body.adName || "");
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const cleanPhone = formatPhone(phone);
    console.log(`[webhook] Meta 리드 접수: ${name} | ${cleanPhone}`);

    // ── 블랙리스트 체크 ──
    let isBlocked = await isBlacklisted(cleanPhone);
    if (isBlocked) {
      console.log(`[webhook] 블랙리스트 차단: ${name} ${cleanPhone}`);
    }

    // ── 자동 블랙리스트 키워드 (동종업계 영업 자동 차단) ──
    // 상위 키워드(대부/렌트/리스/분양 등)가 하위(대부업/렌트카/장기리스/아파트분양)를
    // includes로 모두 흡수하므로 키워드는 최소한으로 유지
    const AUTO_BLACKLIST_KEYWORDS = [
      // 대출/대부
      "대출",
      "대부",
      "사채",
      "카드론",
      // 금융
      "금융",
      "캐피탈",
      "채권추심",
      // 보험
      "보험",
      // 렌트/리스 (단독 "리스"는 "리스타트/릴리스/팰리스트" 등 오탐 위험으로 합성어만)
      "렌트",
      "렌터카",
      "렌탈",
      "자동차리스",
      "차량리스",
      "장기리스",
      "신차리스",
      "장비리스",
      // 분양/부동산
      "분양",
      "지식산업센터",
      "부동산",
    ];
    const allText = [name, company, industry, adName].join(" ");
    const matchedAutoBlacklist = AUTO_BLACKLIST_KEYWORDS.find((kw) =>
      allText.includes(kw),
    );

    if (!isBlocked && matchedAutoBlacklist) {
      const result = await addToBlacklist({
        phone: cleanPhone,
        name,
        reason: `자동 블랙리스트 (${matchedAutoBlacklist})`,
        source: "Meta",
      });
      console.log(
        `[webhook] 자동 블랙리스트 등록: ${matchedAutoBlacklist} | ${cleanPhone} | ${result.ok ? "성공" : result.error}`,
      );
      isBlocked = true;
    }

    // 1. D1 meta_lead 저장
    const id = newId();
    const initialStatus = isBlocked ? "Hold" : "Todo";
    const initialMemo = isBlocked
      ? matchedAutoBlacklist
        ? `[블랙리스트] 자동 (${matchedAutoBlacklist})`
        : "[블랙리스트]"
      : "";

    try {
      await d1Run(
        `INSERT INTO meta_lead
          (id, name, phone, company, industry, ad_name, status, memo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          phone, // 원본 phone 저장 (formatPhone 결과 아닌, +82… 형태)
          company,
          industry,
          adName,
          initialStatus,
          initialMemo,
          nowIso(),
          nowIso(),
        ],
      );
    } catch (e) {
      console.error("D1 meta_lead 저장 실패:", e);
    }

    // 2. SMS 발송
    let smsResult: { success: boolean; error?: string } = {
      success: false,
      error: "",
    };
    if (isBlocked) {
      console.log(`[webhook] SMS 스킵 (블랙리스트): ${cleanPhone}`);
      smsResult = { success: false, error: "블랙리스트 스킵" };
    } else {
      smsResult = await sendLMS(cleanPhone, SMS_MESSAGE);
      console.log(
        `[webhook] SMS 결과: ${smsResult.success ? "성공" : "실패"} ${smsResult.error || ""}`,
      );
    }

    // 3. SMS 상태 업데이트
    try {
      await d1Run(
        `UPDATE meta_lead
         SET sms_status = ?, sms_error = ?, sms_sent_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          isBlocked
            ? "블랙리스트"
            : smsResult.success
              ? "발송완료"
              : "발송실패",
          smsResult.error || "",
          nowIso(),
          nowIso(),
          id,
        ],
      );
    } catch (e) {
      console.error("D1 meta_lead SMS 상태 업데이트 실패:", e);
    }

    // 4. 텔레그램 알림
    if (isBlocked) {
      await sendTelegramBlacklist(name || "-", cleanPhone);
    } else {
      await sendTelegram(
        name || "-",
        cleanPhone,
        company || "",
        industry || "",
        smsResult.success,
      );
    }

    return NextResponse.json({
      ok: true,
      id,
      sms: smsResult.success,
      phone: cleanPhone,
    });
  } catch (error) {
    console.error("[webhook] Meta 리드 처리 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

/**
 * NCP SENS SMS 발송 클라이언트 (master_polarad용)
 * - EUC-KR 인코딩 기준: 이모지/특수문자 자동 제거
 * - LMS: contentType COMM, countryCode 82
 */

import crypto from "crypto";

function cleanEnv(val: string | undefined): string {
  return (val || "").replace(/\\n/g, "").replace(/\n/g, "").trim();
}

const NCP_SERVICE_ID = cleanEnv(process.env.NCP_SERVICE_ID);
const NCP_ACCESS_KEY = cleanEnv(process.env.NCP_ACCESS_KEY);
const NCP_SECRET_KEY = cleanEnv(process.env.NCP_SECRET_KEY);
const NCP_SENDER_PHONE = cleanEnv(process.env.NCP_SENDER_PHONE);
const BASE_URL = "https://sens.apigw.ntruss.com";

function makeSignature(timestamp: string, method: string, url: string): string {
  const hmac = crypto.createHmac("sha256", NCP_SECRET_KEY);
  const message = `${method} ${url}\n${timestamp}\n${NCP_ACCESS_KEY}`;
  return hmac.update(message).digest("base64");
}

/**
 * EUC-KR 미지원 이모지/특수문자 제거
 */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/[\u{E0020}-\u{E007F}]/gu, "");
}

export interface SendSMSResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export async function sendLMS(
  to: string,
  content: string,
  subject?: string,
): Promise<SendSMSResult> {
  if (!NCP_SERVICE_ID || !NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
    return { success: false, error: "NCP SENS 환경변수 미설정" };
  }

  if (!NCP_SENDER_PHONE) {
    return { success: false, error: "NCP_SENDER_PHONE 미설정" };
  }

  const cleanPhone = to.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      error: `유효하지 않은 전화번호: ${to} → ${cleanPhone}`,
    };
  }

  const cleanContent = stripEmoji(content);
  const timestamp = Date.now().toString();
  const url = `/sms/v2/services/${NCP_SERVICE_ID}/messages`;
  const signature = makeSignature(timestamp, "POST", url);

  const body: Record<string, unknown> = {
    type: "LMS",
    contentType: "COMM",
    countryCode: "82",
    from: NCP_SENDER_PHONE.replace(/\D/g, ""),
    content: cleanContent,
    messages: [{ to: cleanPhone }],
  };

  if (subject) {
    body.subject = stripEmoji(subject);
  }

  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": NCP_ACCESS_KEY,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify(body),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // JSON 파싱 실패해도 requestId 없이 진행
    }

    // requestId가 있으면 NCP가 메시지를 접수한 것 → 성공
    if (data.requestId) {
      console.log(
        "SMS 발송 성공:",
        cleanPhone,
        "| requestId:",
        data.requestId,
        "| HTTP:",
        res.status,
      );
      return { success: true, requestId: data.requestId };
    }

    if (!res.ok) {
      console.error(
        "SMS 발송 실패:",
        JSON.stringify(data),
        "| HTTP:",
        res.status,
        "| to:",
        cleanPhone,
        "| from:",
        body.from,
      );
      return {
        success: false,
        error: `HTTP ${res.status}: ${JSON.stringify(data?.error || data?.statusName || res.statusText)}`,
      };
    }

    console.log("SMS 발송 성공:", cleanPhone, "| HTTP:", res.status);
    return { success: true, requestId: data.requestId };
  } catch (error: any) {
    console.error("SMS 발송 에러:", error?.message || error);
    return { success: false, error: error.message };
  }
}

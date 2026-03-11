/**
 * NCP SENS SMS 발송 클라이언트 (master_polarad용)
 * startpackage의 ncpSensClient.ts 기반
 */

import crypto from "crypto";

const NCP_SERVICE_ID = process.env.NCP_SERVICE_ID || "";
const NCP_ACCESS_KEY = process.env.NCP_ACCESS_KEY || "";
const NCP_SECRET_KEY = process.env.NCP_SECRET_KEY || "";
const NCP_SENDER_PHONE = process.env.NCP_SENDER_PHONE || "";
const BASE_URL = "https://sens.apigw.ntruss.com";

function makeSignature(timestamp: string, method: string, url: string): string {
  const hmac = crypto.createHmac("sha256", NCP_SECRET_KEY);
  const message = `${method} ${url}\n${timestamp}\n${NCP_ACCESS_KEY}`;
  return hmac.update(message).digest("base64");
}

export interface SendSMSResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export async function sendLMS(
  to: string,
  content: string,
): Promise<SendSMSResult> {
  if (!NCP_SERVICE_ID || !NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
    return { success: false, error: "NCP SENS 환경변수 미설정" };
  }

  const cleanPhone = to.replace(/-/g, "");
  const timestamp = Date.now().toString();
  const url = `/sms/v2/services/${NCP_SERVICE_ID}/messages`;
  const signature = makeSignature(timestamp, "POST", url);

  const body = {
    type: "LMS",
    from: NCP_SENDER_PHONE,
    content,
    messages: [{ to: cleanPhone, content }],
  };

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

    const data = await res.json();

    if (!res.ok) {
      console.error("SMS 발송 실패:", data);
      return {
        success: false,
        error: data.statusName || res.statusText,
      };
    }

    console.log("SMS 발송 성공:", cleanPhone);
    return { success: true, requestId: data.requestId };
  } catch (error: any) {
    console.error("SMS 발송 에러:", error);
    return { success: false, error: error.message };
  }
}

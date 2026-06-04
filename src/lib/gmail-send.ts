/**
 * Gmail 발송 — Google OAuth2 (googleapis)
 * 발신: mkt9834@gmail.com (GMAIL_SENDER_EMAIL)
 *
 * 환경변수:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN
 *   GMAIL_SENDER_EMAIL   — 발신 주소 (없으면 mkt9834@gmail.com)
 *
 * 계약 전자서명 시스템 전용. PDF 첨부 지원.
 * SMTP(mailer.ts, 네이버웍스)와 별개 경로 — 계약서 발송은 Gmail OAuth 사용.
 */

import { google } from "googleapis";

export interface GmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendGmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
  /** 답장 받을 주소 (선택). 기본은 발신주소. */
  replyTo?: string;
}

function assertConfig(): void {
  const missing = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Gmail 환경변수 누락: ${missing.join(", ")}`);
  }
}

export function getGmailStatus() {
  return {
    sender: process.env.GMAIL_SENDER_EMAIL || "mkt9834@gmail.com",
    ready: Boolean(
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN,
    ),
  };
}

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * RFC2047 — 헤더의 한글/비ASCII를 안전하게 인코딩.
 * 각 encoded-word는 75자 제한이 있어, 긴 문자열은 청크로 분할한다.
 * (단일 over-length encoded-word는 네이버웍스 등에서 디코딩 실패 → 제목 깨짐)
 */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const chunks: string[] = [];
  let cur = "";
  for (const ch of value) {
    if (Buffer.from(cur + ch, "utf-8").length > 30) {
      chunks.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) chunks.push(cur);
  return chunks
    .map((c) => `=?UTF-8?B?${Buffer.from(c, "utf-8").toString("base64")}?=`)
    .join("\r\n ");
}

function sanitizeAddress(addr: string): string {
  return addr.replace(/[\r\n]/g, "").trim();
}

/**
 * MIME(multipart/mixed) 메시지를 조립해 base64url 로 반환.
 * 첨부가 없으면 단일 HTML 파트.
 */
function buildRawMessage(input: SendGmailInput, fromHeader: string): string {
  const to = sanitizeAddress(input.to);
  const subject = encodeHeader(input.subject);
  const replyTo = input.replyTo ? sanitizeAddress(input.replyTo) : "";

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  if (!input.attachments || input.attachments.length === 0) {
    const msg = [
      ...headers,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(input.html, "utf-8").toString("base64"),
    ].join("\r\n");
    return toBase64Url(msg);
  }

  const boundary = `=_polarad_${Buffer.from(String(input.subject))
    .toString("hex")
    .slice(0, 16)}`;

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.html, "utf-8").toString("base64"),
  ];

  for (const att of input.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType || "application/octet-stream"}; name="${encodeHeader(att.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${encodeHeader(att.filename)}"`,
      "",
      att.content.toString("base64"),
    );
  }
  parts.push(`--${boundary}--`, "");

  return toBase64Url(parts.join("\r\n"));
}

function toBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Gmail OAuth2로 메일 발송 (PDF 등 첨부 지원).
 * @returns Gmail message id
 */
export async function sendGmail(input: SendGmailInput): Promise<string> {
  assertConfig();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || "mkt9834@gmail.com";
  const senderName = process.env.GMAIL_FROM_NAME || "폴라애드";
  const fromHeader = `${encodeHeader(senderName)} <${senderEmail}>`;

  const gmail = getGmailClient();
  const raw = buildRawMessage(input, fromHeader);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return res.data.id ?? "";
}

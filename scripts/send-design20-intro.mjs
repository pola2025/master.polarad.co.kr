// 디자인20(이은성 대표) 홈페이지 제작 준비 안내 메일 발송
// 실행: node --env-file=.env.local scripts/send-design20-intro.mjs
//
// 발신: mkt@polarad.co.kr (GMAIL_SENDER_EMAIL)
// 수신: hesonix@gmail.com
// 본문: F:/polarad_frontend/docs/email-design20-preview.html 의 메일 영역

import { readFileSync } from "node:fs";
import { google } from "googleapis";

const TO_EMAIL = "hesonix@gmail.com";
const SUBJECT =
  "[폴라애드] 디자인20 홈페이지 제작 준비 안내 드립니다 — 이은성 대표님";
const PREVIEW_PATH =
  "F:/polarad_frontend/docs/email-design20-preview.html";

// ── 1. OAuth 클라이언트 구성 ─────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground",
);
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// ── 2. 프리뷰 HTML 로드 후 PREVIEW 배너 제거 ──────────────
const rawHtml = readFileSync(PREVIEW_PATH, "utf8");
const mailHtml = rawHtml.replace(
  /<div class="preview-banner"[\s\S]*?<\/div>\s*/,
  "",
);

// ── 3. MIME 구성 ───────────────────────────────────────
const sender = process.env.GMAIL_SENDER_EMAIL || "mkt@polarad.co.kr";

const encodeHeader = (s) =>
  `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;

const mime = [
  `From: ${encodeHeader("폴라애드 POLARAD")} <${sender}>`,
  `To: ${TO_EMAIL}`,
  `Subject: ${encodeHeader(SUBJECT)}`,
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=UTF-8",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from(mailHtml).toString("base64"),
].join("\r\n");

const encoded = Buffer.from(mime)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");

// ── 4. 발송 ────────────────────────────────────────────
const result = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encoded },
});

console.log("✅ Sent");
console.log(`   messageId : ${result.data.id}`);
console.log(`   threadId  : ${result.data.threadId}`);
console.log(`   to        : ${TO_EMAIL}`);
console.log(`   from      : ${sender}`);
console.log(`   subject   : ${SUBJECT}`);

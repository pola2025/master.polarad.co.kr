/**
 * 계약 전자서명 시스템 — 자체 검증 하니스 (Phase 1)
 *
 * 파이프라인 검증: 토큰 치환 → PDF 렌더(Playwright) → 도장/서명 임베드 → Gmail 발송
 *
 * 사용법:
 *   node scripts/contract-verify.mjs            # PDF만 생성 (메일 발송 안 함)
 *   node scripts/contract-verify.mjs --send     # + mkt9834 Gmail로 테스트 발송
 *   node scripts/contract-verify.mjs --send --to someone@x.com
 *
 * 환경변수: GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/SENDER_EMAIL (.env.local)
 *   → node --env-file 미사용 시 아래 loadEnv()가 .env.local 자동 로드.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { google } from "googleapis";
import { buildContractHtml } from "../src/lib/contracts/contract-html.mjs";

const require = createRequire(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PLAYWRIGHT_PATH =
  "C:/Users/flame/AppData/Roaming/npm/node_modules/playwright";
const OUT_DIR = path.join(ROOT, "docs", "contracts");
const OUT_PDF = path.join(OUT_DIR, "verify-신의경영연구소.pdf");

// ── .env.local 수동 로더 (--env-file 안 써도 동작) ─────────────
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// ── 검증용 계약 데이터 (신의경영연구소 — 사업자등록증 기준) ──────
// ⚠️ 금액/기간은 검증용 샘플. 실제 값 확정 시 교체.
const CONTRACT = {
  partyAName: "주식회사 신의경영연구소",
  partyABizName: "주식회사 신의경영연구소",
  partyACeo: "장국진",
  partyABizNo: "253-86-03508",
  partyACorpNo: "110111-9057913",
  partyAAddr: "서울특별시 마포구 와우산로 105, 5층-제이7호(서교동)",
  partyAPhone: "",
  partyAEmail: "",
  monthlyFee: 330000, // ⚠️ 샘플
  periodMonths: 6, // ⚠️ 샘플
  planLabel: "스탠다드 플랜",
  // clientSignature: "data:image/png;base64,..." // 검증 시 갑 서명 테스트 이미지 주입 가능
  signDate: "",
};

function makeTestSignature() {
  // 갑 서명란 임베드 검증용 미니 PNG 서명 (간단한 곡선) — 실제 캔버스 서명 대체
  // 투명 배경 + 검은 선. (1x1 placeholder 대신 식별 가능한 작은 PNG)
  // 여기서는 단순화를 위해 텍스트 기반 SVG→data URL 사용 (PNG 미요구 시).
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='64'><text x='6' y='42' font-family='cursive' font-size='30' fill='%23111'>장국진 (서명)</text></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

async function renderPdf(html) {
  const { chromium } = require(PLAYWRIGHT_PATH);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.pdf({
      path: OUT_PDF,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font-size:8pt;font-family:sans-serif;width:100%;padding:0 16mm;color:#94a3b8;display:flex;justify-content:space-between;">
        <span style="letter-spacing:0.05em;">POLARAD · 온라인마케팅 대행 계약서</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
      margin: { top: "14mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await browser.close();
  }
}

// ── Gmail 발송 (PDF 첨부, multipart/mixed) ─────────────────────
function b64url(str) {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function encHeader(v) {
  if (/^[\x00-\x7F]*$/.test(v)) return v;
  // RFC2047: 각 encoded-word <= 75자. 긴 한글은 청크로 분할(이상 시 네이버웍스 등 디코딩 실패 → 제목 깨짐).
  const chunks = [];
  let cur = "";
  for (const ch of v) {
    if (Buffer.from(cur + ch, "utf-8").length > 30) {
      chunks.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) chunks.push(cur);
  return chunks
    .map((c) => `=?UTF-8?B?${Buffer.from(c, "utf-8").toString("base64")}?=`)
    .join("\r\n ");
}

async function sendMail(to, pdfBuffer) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const sender = process.env.GMAIL_SENDER_EMAIL || "mkt9834@gmail.com";
  const boundary = "=_polarad_verify_boundary";
  const subject = encHeader("[검증] 온라인마케팅 대행 계약서 — 주식회사 신의경영연구소");
  const html = `<p>폴라애드 계약 전자서명 시스템 <b>자체 검증</b> 메일입니다.</p>
<p>첨부된 PDF에서 ① 당사자 정보 주입 ② 금액/기간 ③ 폴라애드 직인(을) ④ 갑 서명란을 확인해주세요.</p>
<p style="color:#888;font-size:12px;">※ 금액/기간은 검증용 샘플값입니다. 실제 값 확정 후 정식 발행됩니다.</p>`;

  const raw = b64url(
    [
      `From: ${encHeader("폴라애드")} <${sender}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html, "utf-8").toString("base64"),
      `--${boundary}`,
      'Content-Type: application/pdf; name="contract-shinui.pdf"',
      "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="contract-shinui.pdf"',
      "",
      pdfBuffer.toString("base64"),
      `--${boundary}--`,
      "",
    ].join("\r\n"),
  );

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return res.data.id;
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const doSend = args.includes("--send");
  const toIdx = args.indexOf("--to");
  const to = toIdx >= 0 ? args[toIdx + 1] : "mkt9834@gmail.com";
  const withSign = args.includes("--with-signature");

  const data = { ...CONTRACT };
  if (withSign) data.clientSignature = makeTestSignature();

  console.log("[1/3] 계약서 HTML 빌드…");
  const html = buildContractHtml(data);
  console.log(`      OK (${html.length.toLocaleString()} chars)`);

  console.log("[2/3] PDF 렌더(Playwright)…");
  await renderPdf(html);
  const pdf = fs.readFileSync(OUT_PDF);
  console.log(`      OK → ${OUT_PDF} (${(pdf.length / 1024).toFixed(0)} KB)`);

  if (doSend) {
    console.log(`[3/3] Gmail 발송 → ${to} …`);
    const id = await sendMail(to, pdf);
    console.log(`      OK (message id: ${id})`);
  } else {
    console.log("[3/3] 발송 생략 (--send 미지정). PDF만 확인하세요.");
  }
  console.log("\n✅ 검증 완료");
}

main().catch((e) => {
  console.error("\n❌ 검증 실패:", e?.message || e);
  process.exit(1);
});

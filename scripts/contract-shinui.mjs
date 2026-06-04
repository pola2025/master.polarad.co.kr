/**
 * 신의경영연구소 계약서 2건 생성 (PDF)
 *
 * 공통: ㈜신의경영연구소 / 장국진 / 253-86-03508 / 마포구 와우산로 105
 * 1) 자수성가 사옥연구소     — 월 220,000원(VAT 포함) · 6개월
 * 2) 정부지원사업 마케팅      — 월 220,000원(VAT 포함) · 4개월
 *
 * 사용법:
 *   node scripts/contract-shinui.mjs                       # 2건 PDF 생성
 *   node scripts/contract-shinui.mjs --send mkt@polarad.co.kr   # 검토용 메일(2건 첨부)
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
const OUT_DIR = path.join(ROOT, "docs", "contracts");

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env))
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const COMMON = {
  partyAName: "주식회사 신의경영연구소",
  partyABizName: "주식회사 신의경영연구소",
  partyACeo: "장국진",
  partyABizNo: "253-86-03508",
  partyACorpNo: "110111-9057913",
  partyAAddr: "서울특별시 마포구 와우산로 105, 5층-제이7호(서교동)",
  partyAPhone: "",
  partyAEmail: "",
  monthlyFee: 220000,
  planLabel: "스탠다드 플랜",
  specialTerms: [
    "본 계약은 주식회사 신의경영연구소의 2건(자수성가 사옥연구소·정부지원사업 마케팅) 동시 계약 진행을 조건으로 하며, 이를 조건으로 구글(Google) 추가 매체 운영비 월 110,000원(VAT 포함)을 계약 기간 동안 면제한다.",
  ],
};

const CONTRACTS = [
  {
    ...COMMON,
    projectName: "자수성가 사옥연구소",
    periodMonths: 6,
    file: "신의경영연구소_자수성가_6개월.pdf",
    attach: "contract-shinui-jasusungga.pdf",
  },
  {
    ...COMMON,
    projectName: "정부지원사업 마케팅",
    periodMonths: 4,
    file: "신의경영연구소_정부지원사업_4개월.pdf",
    attach: "contract-shinui-govsupport.pdf",
  },
];

async function renderPdf(html, outPath) {
  const { chromium } = require(
    "C:/Users/flame/AppData/Roaming/npm/node_modules/playwright",
  );
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outPath,
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

function b64url(s) {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function encH(v) {
  if (/^[\x00-\x7F]*$/.test(v)) return v;
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

async function sendBoth(to, pdfs) {
  const oauth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );
  oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth });
  const sender = process.env.GMAIL_SENDER_EMAIL || "mkt9834@gmail.com";
  const boundary = "=_polarad_shinui";
  const html = `<p>주식회사 신의경영연구소 온라인마케팅 대행 계약서 <b>2건</b> 검토용입니다.</p>
<ul><li>자수성가 사옥연구소 — 월 220,000원(VAT 포함) · 6개월</li>
<li>정부지원사업 마케팅 — 월 220,000원(VAT 포함) · 4개월</li></ul>`;
  const parts = [
    `From: ${encH("폴라애드")} <${sender}>`,
    `To: ${to}`,
    `Subject: ${encH("[검토] 신의경영연구소 온라인마케팅 대행 계약서 2건")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf-8").toString("base64"),
  ];
  for (const { buf, attach } of pdfs) {
    parts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${attach}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attach}"`,
      "",
      buf.toString("base64"),
    );
  }
  parts.push(`--${boundary}--`, "");
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: b64url(parts.join("\r\n")) },
  });
  return res.data.id;
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const sendIdx = args.indexOf("--send");
  const sendTo = sendIdx >= 0 ? args[sendIdx + 1] : null;

  const pdfs = [];
  for (const c of CONTRACTS) {
    const html = buildContractHtml(c);
    const out = path.join(OUT_DIR, c.file);
    await renderPdf(html, out);
    const buf = fs.readFileSync(out);
    pdfs.push({ buf, attach: c.attach });
    console.log(
      `✅ ${c.projectName} (${c.periodMonths}개월) → ${out} (${(buf.length / 1024).toFixed(0)} KB)`,
    );
  }

  if (sendTo) {
    console.log(`\n메일 발송 → ${sendTo} …`);
    const id = await sendBoth(sendTo, pdfs);
    console.log(`✅ 발송 완료 (message id: ${id})`);
  }
}

main().catch((e) => {
  console.error("❌ 실패:", e?.message || e);
  process.exit(1);
});

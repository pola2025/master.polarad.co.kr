import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground",
);
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;
const RECORD_ID = "rec3kI5HigkgMJBX0";
const TO_EMAIL = "framei@naver.com";

const res = await fetch(
  `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${RECORD_ID}`,
  { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } },
);
const data = await res.json();
const f = data.fields;

const biz = f.businessName;
const ns = Number(f.naverScore) || 0;
const gs = Number(f.googleScore) || 0;
const os = Number(f.overallScore) || 0;
const summary = f.summary || "";
const content = f.reportContent || "";

function sc(s) {
  return s <= 30 ? "#EF4444" : s <= 60 ? "#F59E0B" : "#22C55E";
}
function sl(s) {
  return s >= 81 ? "우수" : s >= 61 ? "양호" : s >= 41 ? "보통" : s >= 21 ? "미흡" : "취약";
}

function mdToHtml(md) {
  return md
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t.startsWith("## "))
        return `<h2 style="color:#0066CC;font-size:18px;margin:20px 0 8px;border-bottom:2px solid #0066CC;padding-bottom:4px;">${t.slice(3)}</h2>`;
      if (t.startsWith("### "))
        return `<h3 style="color:#333;font-size:15px;margin:14px 0 6px;">${t.slice(4)}</h3>`;
      if (t.startsWith("- ") || t.startsWith("* "))
        return `<div style="margin:3px 0 3px 16px;font-size:13px;color:#444;">• ${t.slice(2).replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")}</div>`;
      if (t === "") return "<br/>";
      return `<p style="font-size:13px;color:#444;margin:2px 0;">${t.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")}</p>`;
    })
    .join("\n");
}

function sbox(label, score) {
  const c = sc(score);
  return `<div style="flex:1;background:#F8FAFC;border-radius:8px;padding:16px;text-align:center;">
    <div style="color:#888;font-size:11px;margin-bottom:6px;">${label}</div>
    <div style="font-size:36px;font-weight:bold;color:${c};">${score}</div>
    <div style="background:#E5E7EB;border-radius:4px;height:8px;margin:8px 0;">
      <div style="background:${c};border-radius:4px;height:8px;width:${score}%;"></div>
    </div>
    <div style="color:#888;font-size:10px;">${sl(score)}</div>
  </div>`;
}

// 첨부할 HTML 리포트
const reportHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap");
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Noto Sans KR",sans-serif;background:#fff;color:#333;width:800px;max-width:800px}
</style></head><body>
<div style="background:#0066CC;color:white;padding:40px;border-radius:0 0 12px 12px;">
  <div style="font-size:14px;opacity:0.8;margin-bottom:8px;">POLARAD</div>
  <div style="font-size:28px;font-weight:700;line-height:1.3;">브랜드 온라인 검색<br/>평가 리포트</div>
</div>
<div style="padding:30px;">
  <div style="font-size:24px;font-weight:700;margin-bottom:4px;">${biz}</div>
  <div style="color:#888;font-size:14px;margin-bottom:20px;">${f.industry} · ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</div>
  <div style="display:flex;gap:12px;margin-bottom:24px;">
    ${sbox("네이버", ns)}${sbox("구글", gs)}${sbox("종합", os)}
  </div>
  ${summary ? `<div style="background:#EFF6FF;border-left:4px solid #0066CC;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:13px;color:#333;">${summary}</div>` : ""}
  <div style="margin-bottom:30px;">${mdToHtml(content)}</div>
  <div style="background:#0066CC;color:white;padding:24px;border-radius:12px;text-align:center;">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;">폴라애드 통합 마케팅 패키지</div>
    <div style="font-size:12px;opacity:0.8;margin-bottom:12px;">홈페이지 · 블로그 · SNS · Meta 광고 · 인쇄물</div>
    <div style="font-size:11px;opacity:0.7;">polarad.co.kr · 010-9897-9834</div>
  </div>
</div>
</body></html>`;

// 이메일 본문
function ebox(t, s) {
  const c = sc(s);
  return `<td style="width:33%;padding:0 4px;text-align:center;">
    <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px 8px;">
      <div style="font-size:10px;font-weight:700;color:#374151;margin-bottom:4px;white-space:nowrap;">${t}</div>
      <div style="font-size:22px;font-weight:700;color:${c};margin-bottom:2px;">${s}<span style="font-size:11px;font-weight:400;color:#9CA3AF;">/100</span></div>
      <div style="background:#F3F4F6;border-radius:3px;height:6px;overflow:hidden;">
        <div style="background:${c};height:6px;width:${s}%;border-radius:3px;"></div>
      </div>
    </div>
  </td>`;
}

const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F9FAFB;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:#0066CC;border-radius:12px 12px 0 0;padding:32px 36px;">
  <div style="font-size:13px;color:#BFDBFE;letter-spacing:2px;margin-bottom:8px;">POLARAD</div>
  <div style="font-size:22px;font-weight:700;color:#fff;">브랜드 온라인 검색 평가 리포트</div>
</td></tr>
<tr><td style="background:#fff;padding:36px;">
  <p style="font-size:15px;color:#111827;margin:0 0 24px;">안녕하세요, <strong>${biz}</strong> 담당자님.<br>폴라애드에서 브랜드 온라인 검색 평가 리포트를 보내드립니다.</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;"><tr>
    ${ebox("네이버 점수", ns)}${ebox("구글 점수", gs)}${ebox("종합 점수", os)}
  </tr></table>
  <div style="background:#F0F7FF;border-left:4px solid #0066CC;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
    <div style="font-size:12px;font-weight:700;color:#0066CC;margin-bottom:8px;">진단 요약</div>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">${summary}</p>
  </div>
  <p style="font-size:14px;color:#374151;margin:0 0 12px;">자세한 분석 결과는 <strong>첨부된 리포트</strong>를 확인해주세요.</p>
  <div style="background:#F3F4F6;border-radius:6px;padding:10px 14px;margin-bottom:28px;">
    <p style="font-size:12px;color:#6B7280;margin:0;">PC에서 첨부파일을 클릭하시면 상세 분석 결과를 확인하실 수 있습니다.</p>
  </div>
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius:8px;background:#0066CC;">
      <a href="https://polarad.co.kr/contact" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">폴라애드 상담 예약</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="background:#F3F4F6;border-radius:0 0 12px 12px;padding:24px 36px;">
  <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;">폴라애드 (POLARAD)</div>
  <div style="font-size:11px;color:#6B7280;">전화: 010-9897-9834 | 이메일: mkt@polarad.co.kr<br>웹사이트: polarad.co.kr</div>
</td></tr>
</table></td></tr></table></body></html>`;

// MIME with HTML attachment
const sender = process.env.GMAIL_SENDER_EMAIL || "mkt@polarad.co.kr";
const subject = `[폴라애드] ${biz} 브랜드 온라인 검색 평가 리포트`;
const fileName = `브랜드분석리포트_${biz}.html`;
const boundary = "b_" + Date.now().toString(36);

const mime = [
  `From: =?UTF-8?B?${Buffer.from("폴라애드").toString("base64")}?= <${sender}>`,
  `To: ${TO_EMAIL}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "MIME-Version: 1.0",
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  "",
  `--${boundary}`,
  "Content-Type: text/html; charset=UTF-8",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from(emailHtml).toString("base64"),
  "",
  `--${boundary}`,
  `Content-Type: text/html; charset=UTF-8; name="=?UTF-8?B?${Buffer.from(fileName).toString("base64")}?="`,
  "Content-Transfer-Encoding: base64",
  `Content-Disposition: attachment; filename="=?UTF-8?B?${Buffer.from(fileName).toString("base64")}?="`,
  "",
  Buffer.from(reportHtml).toString("base64"),
  "",
  `--${boundary}--`,
];

const raw = mime.join("\r\n");
const encoded = Buffer.from(raw)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");

const result = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encoded },
});
console.log("Sent!", result.data.id);

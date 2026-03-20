/**
 * Brand Report Email - Gmail API + OAuth2
 * 환경변수: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL
 */

import { google } from "googleapis";
import { escapeHtml } from "@/lib/html-escape";

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

function getScoreColor(score: number): string {
  if (score <= 30) return "#EF4444";
  if (score <= 60) return "#F59E0B";
  return "#22C55E";
}

function getScoreLabel(score: number): string {
  if (score <= 30) return "개선 필요";
  if (score <= 60) return "보통";
  return "양호";
}

function buildScoreBox(title: string, score: number): string {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const pct = Math.max(0, Math.min(100, score));

  return `
    <td style="width:33%;padding:0 8px;text-align:center;">
      <div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">${title}</div>
        <div style="font-size:32px;font-weight:700;color:${color};margin-bottom:4px;">${score}</div>
        <div style="font-size:11px;color:${color};margin-bottom:10px;">${label}</div>
        <div style="background:#F3F4F6;border-radius:4px;height:8px;overflow:hidden;">
          <div style="background:${color};height:8px;width:${pct}%;border-radius:4px;"></div>
        </div>
      </div>
    </td>
  `;
}

function buildHtmlEmail(params: {
  businessName: string;
  overallScore: number;
  naverScore: number;
  googleScore: number;
  summary: string;
}): string {
  const { businessName, overallScore, naverScore, googleScore, summary } =
    params;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>브랜드 온라인 검색 평가 리포트</title>
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0066CC;border-radius:12px 12px 0 0;padding:32px 36px;">
              <div style="font-size:13px;color:#BFDBFE;letter-spacing:2px;margin-bottom:8px;">POLARAD</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">브랜드 온라인 검색 평가 리포트</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px;">
              <p style="font-size:15px;color:#111827;margin:0 0 24px;line-height:1.6;">
                안녕하세요, <strong>${escapeHtml(businessName)}</strong> 담당자님.<br>
                폴라애드에서 브랜드 온라인 검색 평가 리포트를 보내드립니다.
              </p>

              <!-- Scores -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  ${buildScoreBox("네이버 점수", naverScore)}
                  ${buildScoreBox("구글 점수", googleScore)}
                  ${buildScoreBox("종합 점수", overallScore)}
                </tr>
              </table>

              <!-- Summary -->
              <div style="background-color:#F0F7FF;border-left:4px solid #0066CC;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
                <div style="font-size:12px;font-weight:700;color:#0066CC;margin-bottom:8px;">진단 요약</div>
                <p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">${escapeHtml(summary)}</p>
              </div>

              <p style="font-size:14px;color:#374151;margin:0 0 28px;line-height:1.6;">
                자세한 분석 결과는 <strong>첨부된 리포트 이미지</strong>를 확인해주세요.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0066CC;">
                    <a href="https://polarad.co.kr/contact"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      폴라애드 상담 예약 &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F3F4F6;border-radius:0 0 12px 12px;padding:24px 36px;">
              <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;">폴라애드 (POLARAD)</div>
              <div style="font-size:11px;color:#6B7280;line-height:1.7;">
                전화: 010-9897-9834 | 이메일: mkt@polarad.co.kr<br>
                웹사이트: polarad.co.kr
              </div>
              <div style="border-top:1px solid #E5E7EB;margin-top:12px;padding-top:10px;">
                <p style="font-size:10px;color:#9CA3AF;margin:0;">
                  본 이메일은 폴라애드 브랜드 온라인 검색 평가 서비스로 발송되었습니다.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gmail API로 이메일 발송 (첨부파일 포함)
 */
export async function sendBrandReportEmail(params: {
  to: string;
  businessName: string;
  overallScore: number;
  naverScore: number;
  googleScore: number;
  summary: string;
  pdfBuffer: Buffer;
}): Promise<boolean> {
  const {
    to,
    businessName,
    overallScore,
    naverScore,
    googleScore,
    summary,
    pdfBuffer,
  } = params;

  const senderEmail = process.env.GMAIL_SENDER_EMAIL || "mkt@polarad.co.kr";
  const subject = `[폴라애드] ${businessName} 브랜드 온라인 검색 평가 리포트`;
  const html = buildHtmlEmail({
    businessName,
    overallScore,
    naverScore,
    googleScore,
    summary,
  });

  const fileName = `브랜드분석리포트_${businessName}.png`;
  const boundary = "boundary_" + Date.now().toString(36);

  // RFC 2822 형식의 MIME 메시지 생성
  const messageParts = [
    `From: 폴라애드 <${senderEmail}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html).toString("base64"),
    "",
    `--${boundary}`,
    `Content-Type: image/png; name="=?UTF-8?B?${Buffer.from(fileName).toString("base64")}?="`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="=?UTF-8?B?${Buffer.from(fileName).toString("base64")}?="`,
    "",
    pdfBuffer.toString("base64"),
    "",
    `--${boundary}--`,
  ];

  const rawMessage = messageParts.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const gmail = getGmailClient();

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[brand-report-email] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[brand-report-email] Gmail API error:", err);
    return false;
  }
}

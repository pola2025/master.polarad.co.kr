/**
 * Brand Report Email - NAVER WORKS SMTP (nodemailer)
 * 환경변수: SMTP_USER, SMTP_PASS, SMTP_FROM_NAME
 */

import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/html-escape";

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.worksmobile.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "mkt@polarad.co.kr",
      pass: process.env.SMTP_PASS!,
    },
  });
}

function getScoreColor(score: number): string {
  if (score <= 30) return "#EF4444";
  if (score <= 60) return "#F59E0B";
  return "#22C55E";
}

function buildScoreBox(title: string, score: number): string {
  const color = getScoreColor(score);
  const pct = Math.max(0, Math.min(100, score));

  return `
    <td style="width:33%;padding:0 4px;text-align:center;">
      <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px 8px;">
        <div style="font-size:10px;font-weight:700;color:#374151;margin-bottom:4px;white-space:nowrap;">${title}</div>
        <div style="font-size:22px;font-weight:700;color:${color};margin-bottom:2px;">${score}<span style="font-size:11px;font-weight:400;color:#9CA3AF;">/100</span></div>
        <div style="background:#F3F4F6;border-radius:3px;height:6px;overflow:hidden;">
          <div style="background:${color};height:6px;width:${pct}%;border-radius:3px;"></div>
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
  reportUrl: string;
}): string {
  const {
    businessName,
    overallScore,
    naverScore,
    googleScore,
    summary,
    reportUrl,
  } = params;

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
              <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;white-space:nowrap;">브랜드 온라인 검색 평가 리포트</div>
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

              <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6;">
                아래 버튼을 클릭하시면 상세 분석 리포트를 확인하실 수 있습니다.
              </p>

              <!-- 리포트 열람 버튼 -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0066CC;">
                    <a href="${reportUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      상세 리포트 확인하기 &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color:#F3F4F6;border-radius:6px;padding:10px 14px;margin-bottom:20px;">
                <p style="font-size:12px;color:#6B7280;margin:0;line-height:1.5;">
                  리포트 열람 시 접수할 때 등록하신 이메일 인증이 필요합니다.
                </p>
              </div>

              <!-- 상담 예약 -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td style="border-radius:8px;border:1px solid #0066CC;">
                    <a href="https://polarad.co.kr/contact"
                       style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:600;color:#0066CC;text-decoration:none;border-radius:8px;">
                      폴라애드 상담 예약
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
 * 네이버웍스 SMTP로 이메일 발송 (리포트 링크 포함)
 */
export async function sendBrandReportEmail(params: {
  to: string;
  businessName: string;
  overallScore: number;
  naverScore: number;
  googleScore: number;
  summary: string;
  reportId: string;
}): Promise<boolean> {
  const {
    to,
    businessName,
    overallScore,
    naverScore,
    googleScore,
    summary,
    reportId,
  } = params;

  const sanitizedTo = to.replace(/[\r\n]/g, "");
  const baseUrl = process.env.FRONTEND_URL || "https://polarad.co.kr";
  const masterUrl = process.env.MASTER_URL || "https://master.polarad.co.kr";
  const reportUrl = `${baseUrl}/report/${reportId}`;

  const senderEmail = process.env.SMTP_USER || "mkt@polarad.co.kr";
  const senderName = process.env.SMTP_FROM_NAME || "폴라애드";
  const subject = `[폴라애드] ${businessName} 브랜드 온라인 검색 평가 리포트`;
  const trackingPixel = `<img src="${masterUrl}/api/email-tracking/${reportId}?t=report" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  const html = buildHtmlEmail({
    businessName,
    overallScore,
    naverScore,
    googleScore,
    summary,
    reportUrl,
  }).replace("</body>", `${trackingPixel}</body>`);

  try {
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `${senderName} <${senderEmail}>`,
      to: sanitizedTo,
      subject,
      html,
    });

    console.log(`[brand-report-email] Email sent to ${sanitizedTo} via SMTP`);
    return true;
  } catch (err) {
    console.error("[brand-report-email] SMTP error:", err);
    return false;
  }
}

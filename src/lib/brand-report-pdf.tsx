/**
 * Brand Report PDF Generator
 * HCTI API로 HTML → 이미지 변환 후 Buffer 반환
 * 프로젝트에 이미 설정된 HCTI_API_USER_ID, HCTI_API_KEY 사용
 */

interface BrandReportPDFData {
  businessName: string;
  industry: string;
  naverScore: number;
  googleScore: number;
  overallScore: number;
  reportContent: string;
  summary: string;
  analyzedAt: string;
}

function getScoreColor(score: number): string {
  if (score >= 61) return "#22C55E";
  if (score >= 31) return "#F59E0B";
  return "#EF4444";
}

function getScoreLabel(score: number): string {
  if (score >= 81) return "우수";
  if (score >= 61) return "양호";
  if (score >= 41) return "보통";
  if (score >= 21) return "미흡";
  return "취약";
}

function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## "))
        return `<h2 style="color:#0066CC;font-size:18px;margin:20px 0 8px;border-bottom:2px solid #0066CC;padding-bottom:4px;">${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith("### "))
        return `<h3 style="color:#333;font-size:15px;margin:14px 0 6px;">${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* "))
        return `<div style="margin:3px 0 3px 16px;font-size:13px;color:#444;">• ${trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")}</div>`;
      if (/^\d+\.\s/.test(trimmed)) {
        const m = trimmed.match(/^(\d+)\.\s*(.*)/);
        return m
          ? `<div style="margin:3px 0 3px 16px;font-size:13px;color:#444;">${m[1]}. ${m[2].replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")}</div>`
          : `<p style="font-size:13px;color:#444;">${trimmed}</p>`;
      }
      if (trimmed === "") return "<br/>";
      return `<p style="font-size:13px;color:#444;margin:2px 0;">${trimmed.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")}</p>`;
    })
    .join("\n");
}

function buildReportHtml(data: BrandReportPDFData): string {
  const dateStr = new Date(data.analyzedAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const scoreBox = (label: string, score: number) => `
    <div style="flex:1;background:#F8FAFC;border-radius:8px;padding:16px;text-align:center;">
      <div style="color:#888;font-size:11px;margin-bottom:6px;">${label}</div>
      <div style="font-size:36px;font-weight:bold;color:${getScoreColor(score)};">${score}</div>
      <div style="background:#E5E7EB;border-radius:4px;height:8px;margin:8px 0;">
        <div style="background:${getScoreColor(score)};border-radius:4px;height:8px;width:${score}%;"></div>
      </div>
      <div style="color:#888;font-size:10px;">${getScoreLabel(score)}</div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans KR',sans-serif; background:#fff; color:#333; width:800px; }
</style>
</head>
<body>
  <!-- COVER -->
  <div style="background:#0066CC;color:white;padding:40px;border-radius:0 0 12px 12px;">
    <div style="font-size:14px;opacity:0.8;margin-bottom:8px;">POLARAD</div>
    <div style="font-size:28px;font-weight:700;line-height:1.3;">브랜드 온라인 검색<br/>평가 리포트</div>
  </div>

  <div style="padding:30px;">
    <div style="font-size:24px;font-weight:700;margin-bottom:4px;">${data.businessName}</div>
    <div style="color:#888;font-size:14px;margin-bottom:20px;">${data.industry} · ${dateStr}</div>

    <!-- SCORES -->
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      ${scoreBox("네이버", data.naverScore)}
      ${scoreBox("구글", data.googleScore)}
      ${scoreBox("종합", data.overallScore)}
    </div>

    <!-- SUMMARY -->
    ${data.summary ? `<div style="background:#EFF6FF;border-left:4px solid #0066CC;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:13px;color:#333;">${data.summary}</div>` : ""}

    <!-- REPORT CONTENT -->
    <div style="margin-bottom:30px;">
      ${markdownToHtml(data.reportContent)}
    </div>

    <!-- CTA -->
    <div style="background:#0066CC;color:white;padding:24px;border-radius:12px;text-align:center;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">폴라애드 통합 마케팅 패키지</div>
      <div style="font-size:12px;opacity:0.8;margin-bottom:12px;">홈페이지 · 블로그 · SNS · Meta 광고 · 인쇄물</div>
      <div style="font-size:11px;opacity:0.7;">polarad.co.kr · 010-9897-9834</div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateBrandReportPDF(
  data: BrandReportPDFData,
): Promise<Buffer> {
  const html = buildReportHtml(data);

  const HCTI_API_USER_ID = process.env.HCTI_API_USER_ID;
  const HCTI_API_KEY = process.env.HCTI_API_KEY;

  if (!HCTI_API_USER_ID || !HCTI_API_KEY) {
    throw new Error("HCTI API credentials not configured");
  }

  // HCTI API로 HTML → 이미지 변환
  const response = await fetch("https://hcti.io/v1/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " +
        Buffer.from(`${HCTI_API_USER_ID}:${HCTI_API_KEY}`).toString("base64"),
    },
    body: JSON.stringify({
      html,
      css: "",
      google_fonts: "Noto Sans KR",
    }),
  });

  if (!response.ok) {
    throw new Error(`HCTI API error: ${response.status}`);
  }

  const { url } = await response.json();

  // 이미지 다운로드
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`Image download error: ${imageResponse.status}`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// HTML 리포트도 직접 export (이메일 본문용)
export { buildReportHtml };

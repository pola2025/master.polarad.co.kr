import { NextRequest, NextResponse } from "next/server";

/**
 * 이메일 수신확인 트래킹 픽셀
 * GET /api/email-tracking/[id]?t=report|contract
 *
 * 1x1 투명 PNG를 반환하면서 Airtable에 열람 시각을 기록
 */

// 1x1 투명 PNG (68 bytes)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const type = req.nextUrl.searchParams.get("t") || "report";

  // 비동기로 열람 기록 (응답 지연 없음)
  recordOpen(id, type).catch((err) =>
    console.error("[email-tracking] record error:", err),
  );

  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function recordOpen(id: string, type: string) {
  const now = new Date().toISOString();

  if (type === "report") {
    // Airtable 브랜드 리포트에 열람 기록
    const token = process.env.AIRTABLE_API_TOKEN;
    const baseId = process.env.BRAND_REPORT_BASE_ID;
    const tableId = process.env.BRAND_REPORT_TABLE_ID;

    if (!token || !baseId || !tableId) return;

    await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          emailOpenedAt: now,
        },
      }),
    });

    console.log(`[email-tracking] Report ${id} opened at ${now}`);
  }

  // TODO: contract 타입 등 추가 시 여기에 분기
}

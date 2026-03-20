import { NextRequest, NextResponse } from "next/server";
import { generateBrandReportPDF } from "@/lib/brand-report-pdf";
import { sendBrandReportEmail } from "@/lib/brand-report-email";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;

const airtableHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
  "Content-Type": "application/json",
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await params;

    // 1. Fetch the report record
    const fetchRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
        cache: "no-store",
      },
    );

    if (!fetchRes.ok) {
      if (fetchRes.status === 404) {
        return NextResponse.json(
          { error: "리포트를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const err = await fetchRes.json();
      console.error("Airtable 조회 실패:", err);
      return NextResponse.json(
        { error: "리포트 조회에 실패했습니다." },
        { status: 500 },
      );
    }

    const record = await fetchRes.json();
    const f = record.fields;

    if (!f.contactEmail) {
      return NextResponse.json(
        { error: "수신자 이메일이 없습니다." },
        { status: 400 },
      );
    }

    // 2. Generate PDF buffer
    const pdfBuffer = await generateBrandReportPDF({
      businessName: f.businessName ?? "",
      industry: f.industry ?? "",
      reportContent: f.reportContent ?? "",
      summary: f.summary ?? "",
      naverScore: f.naverScore ?? 0,
      googleScore: f.googleScore ?? 0,
      overallScore: f.totalScore ?? 0,
      analyzedAt: f.analyzedAt ?? new Date().toISOString(),
    });

    // 3. Send email with PDF attachment
    await sendBrandReportEmail({
      to: f.contactEmail,
      businessName: f.businessName ?? "",
      overallScore: f.totalScore ?? 0,
      naverScore: f.naverScore ?? 0,
      googleScore: f.googleScore ?? 0,
      summary: f.summary ?? "",
      pdfBuffer,
    });

    // 4. Update Airtable: status "sent", sentAt
    const updateRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            status: "sent",
            sentAt: new Date().toISOString(),
          },
        }),
      },
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      console.error("Airtable 상태 업데이트 실패:", err);
      // Email was sent; still return success but log the update failure
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("브랜드 리포트 발송 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

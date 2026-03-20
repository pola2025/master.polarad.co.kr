import { NextRequest, NextResponse } from "next/server";
import { analyzeBrand } from "@/lib/brand-search";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;

const airtableHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
  "Content-Type": "application/json",
});

export async function POST(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const {
      businessName,
      industry,
      contactName,
      contactPhone,
      contactEmail,
      inquiryId,
      inquirySource,
    } = await request.json();

    if (!businessName || !industry) {
      return NextResponse.json(
        { error: "businessName과 industry는 필수입니다." },
        { status: 400 },
      );
    }

    // 1. Create initial record with status "analyzing"
    const createRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`,
      {
        method: "POST",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            businessName,
            industry,
            contactName: contactName ?? "",
            contactPhone: contactPhone ?? "",
            contactEmail: contactEmail ?? "",
            inquiryId: inquiryId ?? "",
            inquirySource: inquirySource ?? "",
            status: "analyzing",
          },
        }),
      },
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error("Airtable 레코드 생성 실패:", err);
      return NextResponse.json(
        { error: "레코드 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    const created = await createRes.json();
    const recordId: string = created.id;

    // 2. Run brand analysis
    let updateFields: Record<string, string | number>;
    try {
      const result = await analyzeBrand({ businessName, industry });
      updateFields = {
        status: "draft",
        reportContent: result.reportContent ?? "",
        summary: result.summary ?? "",
        naverScore: result.naverScore ?? 0,
        googleScore: result.googleScore ?? 0,
        totalScore: result.overallScore ?? 0,
        naverData: JSON.stringify(result.naverResult ?? {}),
        googleData: JSON.stringify(result.googleResult ?? {}),
        analysisErrors: JSON.stringify(result.errors ?? {}),
        analyzedAt: result.analyzedAt ?? new Date().toISOString(),
      };
    } catch (analysisError) {
      console.error("브랜드 분석 실패:", analysisError);
      updateFields = {
        status: "draft",
        summary: `분석 중 오류가 발생했습니다: ${analysisError instanceof Error ? analysisError.message : "알 수 없는 오류"}`,
        reportContent: "",
        naverScore: 0,
        googleScore: 0,
        totalScore: 0,
        naverData: "{}",
        googleData: "{}",
        analysisErrors: JSON.stringify({ report: "분석 실패" }),
        analyzedAt: new Date().toISOString(),
      };
    }

    // 3. Update record with results
    const updateRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({ fields: updateFields }),
      },
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      console.error("Airtable 레코드 업데이트 실패:", err);
      return NextResponse.json(
        { error: "레코드 업데이트에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: recordId });
  } catch (error) {
    console.error("브랜드 리포트 생성 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

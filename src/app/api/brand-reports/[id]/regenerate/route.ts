import { NextRequest, NextResponse } from "next/server";
import { analyzeBrand } from "@/lib/brand-search";

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

    // 1. Fetch existing record to get businessName, industry
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
    const { businessName, industry } = record.fields as {
      businessName?: string;
      industry?: string;
    };

    if (!businessName || !industry) {
      return NextResponse.json(
        { error: "businessName 또는 industry 정보가 없습니다." },
        { status: 400 },
      );
    }

    // 2. Mark as analyzing
    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields: { status: "analyzing" } }),
    });

    // 3. Re-run brand analysis
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
      console.error("브랜드 재분석 실패:", analysisError);
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

    // 4. Update record with new results
    const updateRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("브랜드 리포트 재생성 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

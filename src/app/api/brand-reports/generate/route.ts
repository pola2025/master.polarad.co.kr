import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { analyzeBrand } from "@/lib/brand-search";
import {
  createRecord,
  updateRecord,
  FIELDS,
} from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Allow admin_token cookie (admin UI) or x-api-key header (external callers like polarad.co.kr)
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = request.headers.get("x-api-key");
  const isApiKeyAuth = cronSecret && apiKey && safeCompare(apiKey, cronSecret);
  if (!isApiKeyAuth && !(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      mode, // "pending" = 분석대기만, "analyze" = 즉시 분석 (기본)
    } = await request.json();

    if (
      !businessName ||
      typeof businessName !== "string" ||
      businessName.length > 200
    ) {
      return NextResponse.json(
        { error: "유효하지 않은 업체명" },
        { status: 400 },
      );
    }
    if (industry && industry.length > 100) {
      return NextResponse.json(
        { error: "유효하지 않은 업종" },
        { status: 400 },
      );
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json(
        { error: "유효하지 않은 이메일" },
        { status: 400 },
      );
    }

    const baseFields = {
      [FIELDS.businessName]: businessName,
      [FIELDS.industry]: industry ?? "",
      [FIELDS.contactName]: contactName ?? "",
      [FIELDS.contactPhone]: contactPhone ?? "",
      [FIELDS.contactEmail]: contactEmail ?? "",
      [FIELDS.inquiryId]: inquiryId ?? "",
      [FIELDS.inquirySource]: inquirySource ?? "",
    };

    // 분석대기 모드: 레코드만 생성하고 끝
    if (mode === "pending") {
      const recordId = await createRecord({
        ...baseFields,
        [FIELDS.status]: "pending",
      });
      return NextResponse.json({ success: true, id: recordId });
    }

    // 즉시 분석 모드 (기본)
    const recordId = await createRecord({
      ...baseFields,
      [FIELDS.status]: "analyzing",
    });

    // Run brand analysis
    let updateFields: Record<string, unknown>;
    try {
      const result = await analyzeBrand({
        businessName,
        industry: industry ?? "",
      });
      updateFields = {
        [FIELDS.status]: "draft",
        [FIELDS.reportContent]: result.reportContent ?? "",
        [FIELDS.summary]: result.summary ?? "",
        ...(result.naverScore !== null && {
          [FIELDS.naverScore]: result.naverScore,
        }),
        ...(result.googleScore !== null && {
          [FIELDS.googleScore]: result.googleScore,
        }),
        [FIELDS.overallScore]: result.overallScore,
        [FIELDS.naverSearchData]: JSON.stringify(result.naverResult ?? {}),
        [FIELDS.googleSearchData]: JSON.stringify(result.googleResult ?? {}),
      };
    } catch (analysisError) {
      console.error("브랜드 분석 실패:", analysisError);
      updateFields = {
        [FIELDS.status]: "failed",
        [FIELDS.summary]: `분석 중 오류: ${analysisError instanceof Error ? analysisError.message : "알 수 없는 오류"}`,
      };
    }

    // Update record with results — throws on failure
    await updateRecord(recordId, updateFields);

    return NextResponse.json({ success: true, id: recordId });
  } catch (error) {
    console.error("브랜드 리포트 생성 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

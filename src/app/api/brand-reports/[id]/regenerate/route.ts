export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { analyzeBrand } from "@/lib/brand-search";
import {
  getRecord,
  updateRecord,
  NotFoundError,
  FIELDS,
} from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = request.headers.get("x-api-key");
  const isApiKeyAuth = cronSecret && apiKey && safeCompare(apiKey, cronSecret);
  if (!isApiKeyAuth && !(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }

    // 1. Fetch existing record
    const record = await getRecord(id);
    const f = record.fields as Record<string, unknown>;
    const businessName = f[FIELDS.businessName] as string | undefined;
    const industry = f[FIELDS.industry] as string | undefined;

    if (!businessName || !industry) {
      return NextResponse.json(
        { error: "businessName 또는 industry 정보가 없습니다." },
        { status: 400 },
      );
    }

    // 2. Mark as analyzing
    await updateRecord(id, { [FIELDS.status]: "analyzing" });

    // 3. Re-run brand analysis
    let updateFields: Record<string, unknown>;
    try {
      const result = await analyzeBrand({ businessName, industry });
      updateFields = {
        [FIELDS.status]: "draft",
        [FIELDS.reportContent]: result.reportContent ?? "",
        [FIELDS.reportHTML]: result.reportHTML ?? "",
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
        [FIELDS.aiSearchData]: JSON.stringify(result.aiResult ?? {}),
      };
    } catch (analysisError) {
      console.error("브랜드 재분석 실패:", analysisError);
      updateFields = {
        [FIELDS.status]: "failed",
        [FIELDS.summary]: `분석 중 오류가 발생했습니다: ${analysisError instanceof Error ? analysisError.message : "알 수 없는 오류"}`,
      };
    }

    // 4. Update record with new results — throws on failure
    await updateRecord(id, updateFields);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 재생성 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

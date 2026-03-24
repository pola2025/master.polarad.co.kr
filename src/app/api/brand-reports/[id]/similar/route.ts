import { NextRequest, NextResponse } from "next/server";
import {
  getRecord,
  updateRecord,
  NotFoundError,
  FIELDS,
} from "@/lib/brand-reports/airtable";
import { generateSimilarNameReportHTML } from "@/lib/brand-search/report-html";
import { requireAuth } from "@/lib/auth-check";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }

    const record = await getRecord(id);
    const f = record.fields as Record<string, unknown>;
    const businessName = (f[FIELDS.businessName] as string) || "";
    const industry = (f[FIELDS.industry] as string) || "";
    const contactName = (f[FIELDS.contactName] as string) || "";

    const reportHTML = generateSimilarNameReportHTML({
      businessName,
      industry,
      contactName,
      reportNo: `RPT-${id.slice(-6).toUpperCase()}`,
    });

    const reportContent = `## 유사상호 판별 보류\n\n'${businessName}' 상호명은 동일·유사한 이름의 다른 업체가 다수 존재하여 정확한 브랜드 식별이 어렵습니다.\n\n정확한 분석을 위해 공식 웹사이트, SNS 계정, 사업장 주소, 네이버 플레이스 등록 여부 등의 정보가 필요합니다.`;

    await updateRecord(id, {
      [FIELDS.status]: "draft",
      [FIELDS.reportContent]: reportContent,
      [FIELDS.reportHTML]: reportHTML,
      [FIELDS.summary]: `유사상호로 분류됨. '${businessName}' 상호 검색 시 다수의 동일·유사 업체가 검색되어 점수 산출 보류.`,
      [FIELDS.overallScore]: null,
      [FIELDS.naverScore]: null,
      [FIELDS.googleScore]: null,
      [FIELDS.naverSearchData]: "",
      [FIELDS.googleSearchData]: "",
      [FIELDS.aiSearchData]: "",
      analysisType: "similar",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("유사상호 처리 오류:", error);
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `서버 오류: ${msg}` }, { status: 500 });
  }
}

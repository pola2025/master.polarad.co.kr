import { NextRequest, NextResponse } from "next/server";
import {
  getRecord,
  normalizeRecord,
  NotFoundError,
} from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";
import {
  generateReportHTML,
  type ReportHTMLInput,
} from "@/lib/brand-search/report-html";
import type { NaverSearchResult } from "@/lib/brand-search/naver";
import type { GoogleSearchResult } from "@/lib/brand-search/google";
import type { AISearchResult } from "@/lib/brand-search/ai-search";

export async function GET(
  _request: NextRequest,
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
    const report = normalizeRecord(record);

    const now = new Date();
    const input: ReportHTMLInput = {
      businessName: report.businessName,
      industry: report.industry,
      reportDate: now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      reportNo: `BR-${id.slice(-6).toUpperCase()}`,
      naverResult:
        (report.naverSearchData as unknown as NaverSearchResult) ?? null,
      googleResult:
        (report.googleSearchData as unknown as GoogleSearchResult) ?? null,
      aiResult: (report.aiSearchData as unknown as AISearchResult) ?? null,
      localKeywordResult: null,
      naverScore: report.naverScore,
      googleScore: report.googleScore,
      overallScore: report.overallScore ?? 0,
      summary: report.summary || undefined,
    };

    const html = generateReportHTML(input);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 미리보기 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

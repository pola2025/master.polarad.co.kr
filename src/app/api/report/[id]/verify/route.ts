import { NextRequest, NextResponse } from "next/server";
import {
  getRecord,
  normalizeRecord,
  NotFoundError,
} from "@/lib/brand-reports/airtable";
import {
  generateReportHTML,
  type ReportHTMLInput,
} from "@/lib/brand-search/report-html";
import type { NaverSearchResult } from "@/lib/brand-search/naver";
import type { GoogleSearchResult } from "@/lib/brand-search/google";
import type { AISearchResult } from "@/lib/brand-search/ai-search";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    const record = await getRecord(id);
    const report = normalizeRecord(record);

    // 이메일 매칭 (대소문자 무시)
    if (
      report.contactEmail.toLowerCase().trim() !== email.toLowerCase().trim()
    ) {
      return NextResponse.json(
        { error: "접수 시 등록한 이메일과 일치하지 않습니다." },
        { status: 403 },
      );
    }

    // HTML 리포트 생성
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

    return NextResponse.json({ html });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("리포트 인증 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

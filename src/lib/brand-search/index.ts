import { searchNaver, type NaverSearchResult } from "./naver";
import { searchGoogle, type GoogleSearchResult } from "./google";
import { searchAI, type AISearchResult } from "./ai-search";
import { generateReport, getGrade } from "./report-generator";
import { generateReportHTML, type ReportHTMLInput } from "./report-html";

export type { NaverSearchResult } from "./naver";
export type { GoogleSearchResult } from "./google";
export type { AISearchResult } from "./ai-search";
export { getGrade } from "./report-generator";
export { generateReportHTML, type ReportHTMLInput } from "./report-html";

// Industry weight profiles: how much Naver vs Google matters per industry
const INDUSTRY_PROFILES: Record<string, { naver: number; google: number }> = {
  음식점: { naver: 0.8, google: 0.2 },
  카페: { naver: 0.8, google: 0.2 },
  병원: { naver: 0.7, google: 0.3 },
  학원: { naver: 0.7, google: 0.3 },
  뷰티: { naver: 0.75, google: 0.25 },
  제조업: { naver: 0.4, google: 0.6 },
  IT: { naver: 0.4, google: 0.6 },
  무역: { naver: 0.3, google: 0.7 },
};

const DEFAULT_WEIGHTS = { naver: 0.6, google: 0.4 };

export function getIndustryWeights(industry: string): {
  naver: number;
  google: number;
} {
  for (const [key, weights] of Object.entries(INDUSTRY_PROFILES)) {
    if (industry.includes(key)) {
      return weights;
    }
  }
  return DEFAULT_WEIGHTS;
}

export interface BrandAnalysisResult {
  businessName: string;
  industry: string;
  analyzedAt: string;

  // Search data (null when the search itself failed)
  naverResult: NaverSearchResult | null;
  googleResult: GoogleSearchResult | null;
  aiResult: AISearchResult | null;

  // Report
  reportContent: string;
  reportHTML: string;
  summary: string;

  // Scores (null = that source failed entirely)
  naverScore: number | null;
  googleScore: number | null;
  overallScore: number;

  // Status
  analysisStatus: "success" | "partial" | "failed";

  // Error details
  errors: string[];
}

export async function analyzeBrand(params: {
  businessName: string;
  industry: string;
}): Promise<BrandAnalysisResult> {
  const { businessName, industry } = params;
  const analyzedAt = new Date().toISOString();
  const errors: string[] = [];

  // Step 1: Run Naver, Google, and AI searches in parallel
  const [naverSettled, googleSettled, aiSettled] = await Promise.allSettled([
    searchNaver(businessName, industry),
    searchGoogle(businessName, industry),
    searchAI(businessName, industry),
  ]);

  let naverResult: NaverSearchResult | null = null;
  let googleResult: GoogleSearchResult | null = null;
  let aiResult: AISearchResult | null = null;
  let naverScore: number | null = null;
  let googleScore: number | null = null;

  if (naverSettled.status === "fulfilled") {
    naverResult = naverSettled.value;
    naverScore = naverResult.score;
  } else {
    const msg =
      naverSettled.reason instanceof Error
        ? naverSettled.reason.message
        : "Naver search failed";
    errors.push(`네이버: ${msg}`);
  }

  if (googleSettled.status === "fulfilled") {
    googleResult = googleSettled.value;
    googleScore = googleResult.score;
  } else {
    const msg =
      googleSettled.reason instanceof Error
        ? googleSettled.reason.message
        : "Google search failed";
    errors.push(`구글: ${msg}`);
  }

  if (aiSettled.status === "fulfilled") {
    aiResult = aiSettled.value;
  } else {
    const msg =
      aiSettled.reason instanceof Error
        ? aiSettled.reason.message
        : "AI search failed";
    errors.push(`AI 검색: ${msg}`);
  }

  // Step 2: Determine overall score and status based on available data
  const weights = getIndustryWeights(industry);
  let overallScore: number;
  let analysisStatus: BrandAnalysisResult["analysisStatus"];

  if (naverScore !== null && googleScore !== null) {
    overallScore = Math.round(
      naverScore * weights.naver + googleScore * weights.google,
    );
    analysisStatus = "success";
  } else if (naverScore !== null) {
    // Only Naver available — use it at 100% weight
    overallScore = naverScore;
    analysisStatus = "partial";
  } else if (googleScore !== null) {
    // Only Google available — use it at 100% weight
    overallScore = googleScore;
    analysisStatus = "partial";
  } else {
    overallScore = 0;
    analysisStatus = "failed";
  }

  // Step 3: Generate report with whatever data we have
  let reportContent: string;
  let summary: string;

  try {
    const reportResult = await generateReport({
      businessName,
      industry,
      naverResult,
      googleResult,
      aiResult,
      overallScore,
    });
    reportContent = reportResult.reportContent;
    summary = reportResult.summary;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Report generation failed";
    errors.push(`리포트: ${msg}`);
    const { grade, label } = getGrade(overallScore);
    summary = `${businessName} 브랜드 검색 분석 완료 (종합 점수: ${overallScore}/100, ${grade}등급 · ${label})`;
    reportContent = `보고서 생성 실패: ${msg}`;
  }

  // Step 4: Generate HTML report
  const now = new Date();
  const reportDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const reportNo = `PA-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 900) + 100)}`;

  const reportHTML = generateReportHTML({
    businessName,
    industry,
    reportDate,
    reportNo,
    naverResult,
    googleResult,
    aiResult,
    naverScore,
    googleScore,
    overallScore,
    summary,
  });

  return {
    businessName,
    industry,
    analyzedAt,
    naverResult,
    googleResult,
    aiResult,
    reportContent,
    reportHTML,
    summary,
    naverScore,
    googleScore,
    overallScore,
    analysisStatus,
    errors,
  };
}

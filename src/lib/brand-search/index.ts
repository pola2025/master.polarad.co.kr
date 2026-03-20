import { searchNaver, type NaverSearchResult } from "./naver";
import { searchGoogle, type GoogleSearchResult } from "./google";
import { generateReport } from "./report-generator";

export type { NaverSearchResult } from "./naver";
export type { GoogleSearchResult } from "./google";

export interface BrandAnalysisResult {
  businessName: string;
  industry: string;
  analyzedAt: string;

  // Search data
  naverResult: NaverSearchResult;
  googleResult: GoogleSearchResult;

  // Report
  reportContent: string;
  summary: string;

  // Scores
  naverScore: number;
  googleScore: number;
  overallScore: number;

  // Errors (partial failure tracking)
  errors: {
    naver?: string;
    google?: string;
    report?: string;
  };
}

export async function analyzeBrand(params: {
  businessName: string;
  industry: string;
}): Promise<BrandAnalysisResult> {
  const { businessName, industry } = params;
  const analyzedAt = new Date().toISOString();
  const errors: BrandAnalysisResult["errors"] = {};

  // Step 1: Run Naver and Google searches in parallel
  const [naverSettled, googleSettled] = await Promise.allSettled([
    searchNaver(businessName),
    searchGoogle(businessName, industry),
  ]);

  let naverResult: NaverSearchResult;
  let googleResult: GoogleSearchResult;

  if (naverSettled.status === "fulfilled") {
    naverResult = naverSettled.value;
  } else {
    const msg =
      naverSettled.reason instanceof Error
        ? naverSettled.reason.message
        : "Naver search failed";
    errors.naver = msg;
    // Zero-score fallback
    naverResult = {
      webResults: [],
      blogResults: [],
      cafeResults: [],
      newsResults: [],
      localResults: [],
      totalCounts: { web: 0, blog: 0, cafe: 0, news: 0, local: 0 },
      score: 0,
      scoreBreakdown: {
        officialWebsite: 0,
        blogMentions: 0,
        localRegistration: 0,
        newsCoverage: 0,
        cafeMentions: 0,
        brandContent: 0,
      },
    };
  }

  if (googleSettled.status === "fulfilled") {
    googleResult = googleSettled.value;
  } else {
    const msg =
      googleSettled.reason instanceof Error
        ? googleSettled.reason.message
        : "Google search failed";
    errors.google = msg;
    // Zero-score fallback
    googleResult = {
      isIndexed: false,
      topRankPosition: null,
      hasGoogleBusiness: false,
      hasReviews: false,
      hasImageResults: false,
      details: `Google 검색 분석 실패: ${msg}`,
      score: 0,
      scoreBreakdown: {
        indexed: 0,
        topRank: 0,
        googleBusiness: 0,
        reviews: 0,
        imagePresence: 0,
      },
    };
  }

  // Step 2: Generate report with whatever data we have
  let reportContent: string;
  let summary: string;
  let overallScore: number;

  try {
    const reportResult = await generateReport({
      businessName,
      industry,
      naverResult,
      googleResult,
    });
    reportContent = reportResult.reportContent;
    summary = reportResult.summary;
    overallScore = reportResult.overallScore;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Report generation failed";
    errors.report = msg;
    overallScore = Math.round(
      naverResult.score * 0.6 + googleResult.score * 0.4,
    );
    summary = `${businessName} 브랜드 검색 분석 완료 (종합 점수: ${overallScore}/100)`;
    reportContent = `보고서 생성 실패: ${msg}`;
  }

  return {
    businessName,
    industry,
    analyzedAt,
    naverResult,
    googleResult,
    reportContent,
    summary,
    naverScore: naverResult.score,
    googleScore: googleResult.score,
    overallScore,
    errors,
  };
}

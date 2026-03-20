import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NaverSearchResult } from "./naver";
import type { GoogleSearchResult } from "./google";

interface ReportInput {
  businessName: string;
  industry: string;
  naverResult: NaverSearchResult;
  googleResult: GoogleSearchResult;
}

interface ReportOutput {
  reportContent: string;
  summary: string;
  overallScore: number;
}

function buildPrompt(params: ReportInput): string {
  const { businessName, industry, naverResult, googleResult } = params;

  const naverScore = naverResult.score;
  const googleScore = googleResult.score;

  // Weighted average: Naver 60% (Korean market priority), Google 40%
  const overallScore = Math.round(naverScore * 0.6 + googleScore * 0.4);

  return `당신은 디지털 마케팅 전문가입니다. 아래 브랜드 검색 분석 데이터를 바탕으로 종합 보고서를 작성해주세요.

## 분석 대상
- 업체명: ${businessName}
- 업종: ${industry}

## 네이버 검색 데이터
- 네이버 종합 점수: ${naverScore}/100
- 웹문서 검색 결과 수: ${naverResult.totalCounts.web}건
- 블로그 언급 수: ${naverResult.totalCounts.blog}건
- 카페/커뮤니티 언급 수: ${naverResult.totalCounts.cafe}건
- 뉴스 보도 수: ${naverResult.totalCounts.news}건
- 플레이스(지도) 등록: ${naverResult.localResults.length > 0 ? "등록됨" : "미등록"}
- 점수 세부 내역:
  - 공식 웹사이트: ${naverResult.scoreBreakdown.officialWebsite}/20점
  - 블로그 언급: ${naverResult.scoreBreakdown.blogMentions}/20점
  - 플레이스 등록: ${naverResult.scoreBreakdown.localRegistration}/20점
  - 뉴스 보도: ${naverResult.scoreBreakdown.newsCoverage}/15점
  - 카페 언급: ${naverResult.scoreBreakdown.cafeMentions}/10점
  - 브랜드 웹 콘텐츠: ${naverResult.scoreBreakdown.brandContent}/15점

## 구글 검색 데이터
- 구글 종합 점수: ${googleScore}/100
- 구글 인덱싱: ${googleResult.isIndexed ? "됨" : "안됨"}
- 공식 사이트 순위: ${googleResult.topRankPosition !== null ? `${googleResult.topRankPosition}위` : "상위 10위 밖"}
- 구글 비즈니스 프로필: ${googleResult.hasGoogleBusiness ? "등록됨" : "미등록"}
- 구글 리뷰: ${googleResult.hasReviews ? "있음" : "없음"}
- 이미지 검색 노출: ${googleResult.hasImageResults ? "있음" : "없음"}
- 구글 분석 상세: ${googleResult.details}

## 종합 점수
- 네이버(60%) + 구글(40%) 가중 평균: ${overallScore}/100

위 데이터를 바탕으로 다음 구조로 마크다운 보고서를 작성해주세요. 각 섹션을 상세하게 작성하고, 구체적이고 실행 가능한 내용을 포함해주세요.

## 종합 평가
(전체 점수 요약, 현재 브랜드 검색 노출 수준 평가)

## 네이버 검색 분석
(각 카테고리별 상세 분석: 웹문서, 블로그, 뉴스, 카페, 플레이스)

## 구글 검색 분석
(인덱싱, 순위, 비즈니스 프로필, 리뷰, 이미지 검색 상세 분석)

## 개선 제안사항
(우선순위 순으로 3-5개 구체적 개선 방안 제시, 각 항목마다 예상 효과 포함)

## 총평
(2-3문장으로 현재 상황과 개선 방향 요약)

보고서 작성 후, 마지막에 다음 형식으로 한 줄 요약을 추가해주세요:
SUMMARY: [1-2문장 핵심 요약]`;
}

export async function generateReport(
  params: ReportInput,
): Promise<ReportOutput> {
  const { naverResult, googleResult } = params;

  // Weighted average: Naver 60%, Google 40%
  const overallScore = Math.round(
    naverResult.score * 0.6 + googleResult.score * 0.4,
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const prompt = buildPrompt(params);

  try {
    const result = await model.generateContent(prompt);
    const fullText = result.response.text();

    // Extract summary from end of response
    const summaryMatch = fullText.match(/SUMMARY:\s*(.+?)(?:\n|$)/);
    const summary = summaryMatch
      ? summaryMatch[1].trim()
      : `${params.businessName}의 브랜드 검색 종합 점수는 ${overallScore}점입니다.`;

    // Remove the SUMMARY line from the report content
    const reportContent = fullText.replace(/\nSUMMARY:[\s\S]*$/, "").trim();

    return {
      reportContent,
      summary,
      overallScore,
    };
  } catch (error) {
    // Fallback minimal report if Gemini fails
    const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";

    const fallbackReport = `## 종합 평가

브랜드 검색 분석 보고서 생성 중 오류가 발생했습니다: ${errorMsg}

**네이버 점수**: ${naverResult.score}/100
**구글 점수**: ${googleResult.score}/100
**종합 점수**: ${overallScore}/100

## 네이버 검색 분석

- 웹문서: ${naverResult.totalCounts.web}건
- 블로그: ${naverResult.totalCounts.blog}건
- 뉴스: ${naverResult.totalCounts.news}건
- 카페: ${naverResult.totalCounts.cafe}건
- 플레이스: ${naverResult.localResults.length > 0 ? "등록됨" : "미등록"}

## 구글 검색 분석

${googleResult.details}

## 총평

데이터 수집은 완료되었으나 AI 분석 리포트 생성에 실패했습니다. 원시 데이터를 참고해주세요.`;

    return {
      reportContent: fallbackReport,
      summary: `${params.businessName} 검색 분석 완료 (종합 점수: ${overallScore}/100). AI 리포트 생성 실패.`,
      overallScore,
    };
  }
}

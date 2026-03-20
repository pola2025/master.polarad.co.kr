import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NaverSearchResult } from "./naver";
import type { GoogleSearchResult } from "./google";

interface ReportInput {
  businessName: string;
  industry: string;
  naverResult: NaverSearchResult | null;
  googleResult: GoogleSearchResult | null;
  overallScore: number;
}

interface ReportOutput {
  reportContent: string;
  summary: string;
}

function getGrade(score: number): { grade: string; label: string } {
  if (score >= 85) return { grade: "A", label: "우수" };
  if (score >= 70) return { grade: "B", label: "양호" };
  if (score >= 50) return { grade: "C", label: "보통" };
  if (score >= 30) return { grade: "D", label: "미흡" };
  return { grade: "F", label: "취약" };
}

function formatSnippets(
  items: { title: string; description: string }[],
  limit = 5,
): string {
  return items
    .slice(0, limit)
    .map((item, i) => {
      const desc = item.description?.substring(0, 100) || "";
      return `${i + 1}. ${item.title} - ${desc}`;
    })
    .join("\n");
}

function buildPrompt(params: ReportInput): string {
  const { businessName, industry, naverResult, googleResult, overallScore } =
    params;

  const naverScore = naverResult?.score ?? null;
  const googleScore = googleResult?.score ?? null;
  const { grade, label } = getGrade(overallScore);

  // Build Naver section
  let naverSection = "네이버 검색 데이터를 가져오지 못했습니다.";
  if (naverResult !== null && naverScore !== null) {
    const blogSnippets =
      naverResult.blogResults.length > 0
        ? `\n### 네이버 블로그 상위 5개 결과:\n${formatSnippets(naverResult.blogResults)}`
        : "";
    const newsSnippets =
      naverResult.newsResults.length > 0
        ? `\n### 네이버 뉴스 상위 5개 결과:\n${formatSnippets(naverResult.newsResults)}`
        : "";
    const cafeSnippets =
      naverResult.cafeResults.length > 0
        ? `\n### 네이버 카페 상위 5개 결과:\n${formatSnippets(naverResult.cafeResults)}`
        : "";
    const webSnippets =
      naverResult.webResults.length > 0
        ? `\n### 네이버 웹문서 상위 5개 결과:\n${formatSnippets(naverResult.webResults)}`
        : "";

    naverSection = `- 네이버 종합 점수: ${naverScore}/100
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
${webSnippets}${blogSnippets}${newsSnippets}${cafeSnippets}`;
  }

  // Build Google section
  let googleSection = "구글 검색 데이터를 가져오지 못했습니다.";
  if (googleResult !== null && googleScore !== null) {
    googleSection = `- 구글 종합 점수: ${googleScore}/100
- 구글 인덱싱: ${googleResult.isIndexed ? "됨" : "안됨"}
- 공식 사이트 순위: ${googleResult.topRankPosition !== null ? `${googleResult.topRankPosition}위` : "상위 10위 밖"}
- 구글 비즈니스 프로필: ${googleResult.hasGoogleBusiness ? "등록됨" : "미등록"}
- 구글 리뷰: ${googleResult.hasReviews ? "있음" : "없음"}
- 이미지 검색 노출: ${googleResult.hasImageResults ? "있음" : "없음"}
- 구글 분석 상세: ${googleResult.details}`;
  }

  // Score availability description
  const scoreDesc =
    naverScore !== null && googleScore !== null
      ? `네이버(${naverScore}/100) + 구글(${googleScore}/100) 가중 평균`
      : naverScore !== null
        ? `네이버(${naverScore}/100) 단독 (구글 데이터 없음)`
        : googleScore !== null
          ? `구글(${googleScore}/100) 단독 (네이버 데이터 없음)`
          : "데이터 없음";

  return `당신은 디지털 마케팅 전문가입니다. 아래 브랜드 검색 분석 데이터를 바탕으로 종합 보고서를 작성해주세요.

## 분석 대상
- 업체명: ${businessName}
- 업종: ${industry}

## 네이버 검색 데이터
${naverSection}

## 구글 검색 데이터
${googleSection}

## 종합 점수
- ${scoreDesc}: ${overallScore}/100
- 등급: ${grade}등급 (${label})

위 데이터를 바탕으로 다음 구조로 마크다운 보고서를 작성해주세요. 각 섹션을 상세하게 작성하고, 구체적이고 실행 가능한 내용을 포함해주세요. 검색 결과에 구체적인 내용(블로그 제목, 뉴스 내용 등)이 있다면 이를 분석에 인용해주세요.

## 종합 평가
(전체 점수 요약 — 종합 점수 ${overallScore}/100, ${grade}등급(${label}) 언급 포함, 현재 브랜드 검색 노출 수준 평가)

## 네이버 검색 분석
(각 카테고리별 상세 분석: 웹문서, 블로그, 뉴스, 카페, 플레이스. 상위 결과에 나타난 구체적인 내용 언급)

## 구글 검색 분석
(인덱싱, 순위, 비즈니스 프로필, 리뷰, 이미지 검색 상세 분석)

## 개선 제안사항
(우선순위 순으로 3-5개 구체적 개선 방안 제시, 각 항목마다 예상 효과 포함)

## 총평
(2-3문장으로 현재 상황과 개선 방향 요약, 등급과 점수 포함)

보고서 작성 후, 마지막에 다음 형식으로 한 줄 요약을 추가해주세요:
SUMMARY: [1-2문장 핵심 요약 — 반드시 점수와 등급 포함]`;
}

export { getGrade };

export async function generateReport(
  params: ReportInput,
): Promise<ReportOutput> {
  const { businessName, overallScore } = params;
  const { grade, label } = getGrade(overallScore);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
  });

  const prompt = buildPrompt(params);

  try {
    const result = await model.generateContent(prompt);
    const fullText = result.response.text();

    // Extract summary from end of response
    const summaryMatch = fullText.match(/SUMMARY:\s*(.+?)(?:\n|$)/);
    const summary = summaryMatch
      ? summaryMatch[1].trim()
      : `${businessName}의 브랜드 검색 종합 점수는 ${overallScore}점 (${grade}등급 · ${label})입니다.`;

    // Remove the SUMMARY line from the report content
    const reportContent = fullText.replace(/\nSUMMARY:[\s\S]*$/, "").trim();

    return {
      reportContent,
      summary,
    };
  } catch (error) {
    // Fallback minimal report if Gemini fails
    const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
    const naverScore = params.naverResult?.score ?? "N/A";
    const googleScore = params.googleResult?.score ?? "N/A";

    const fallbackReport = `## 종합 평가

브랜드 검색 분석 보고서 생성 중 오류가 발생했습니다: ${errorMsg}

**네이버 점수**: ${naverScore}/100
**구글 점수**: ${googleScore}/100
**종합 점수**: ${overallScore}/100 (${grade}등급 · ${label})

## 네이버 검색 분석

- 웹문서: ${params.naverResult?.totalCounts.web ?? 0}건
- 블로그: ${params.naverResult?.totalCounts.blog ?? 0}건
- 뉴스: ${params.naverResult?.totalCounts.news ?? 0}건
- 카페: ${params.naverResult?.totalCounts.cafe ?? 0}건
- 플레이스: ${(params.naverResult?.localResults.length ?? 0) > 0 ? "등록됨" : "미등록"}

## 구글 검색 분석

${params.googleResult?.details ?? "데이터 없음"}

## 총평

데이터 수집은 완료되었으나 AI 분석 리포트 생성에 실패했습니다. 원시 데이터를 참고해주세요.`;

    return {
      reportContent: fallbackReport,
      summary: `${businessName} 검색 분석 완료 (종합 점수: ${overallScore}/100, ${grade}등급 · ${label}). AI 리포트 생성 실패.`,
    };
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NaverSearchResult } from "./naver";
import type { GoogleSearchResult } from "./google";
import type { AISearchResult } from "./ai-search";
import type { LocalKeywordSearchResult } from "./local-keywords";

interface ReportInput {
  businessName: string;
  industry: string;
  naverResult: NaverSearchResult | null;
  googleResult: GoogleSearchResult | null;
  aiResult: AISearchResult | null;
  localKeywordResult: LocalKeywordSearchResult | null;
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
  const {
    businessName,
    industry,
    naverResult,
    googleResult,
    aiResult,
    localKeywordResult,
    overallScore,
  } = params;

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

  // Build AI search section
  let aiSection = "AI 검색 데이터를 가져오지 못했습니다.";
  if (aiResult && aiResult.models.length > 0) {
    const lines = aiResult.models.map((m) => {
      if (m.error) return `- ${m.model}: 체크 실패 (${m.error})`;
      const status = m.knows ? "인지됨" : "미인지";
      const accuracy = m.accurate ? "정확" : "부정확";
      const resp = m.response.substring(0, 150);
      return `- ${m.model}: ${status} / ${accuracy}\n  응답 요약: "${resp}..."`;
    });
    aiSection = `- AI 인지도 점수: ${aiResult.score}/100\n- 체크 요약: ${aiResult.summary}\n${lines.join("\n")}`;
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

  return `당신은 브랜드 온라인 검색 진단 전문가입니다.
아래 데이터를 기반으로 '${businessName}'(${industry})의 온라인 검색 현황 진단 보고서를 작성하세요.

**작성 규칙:**
- 분석 결과를 객관적 사실 중심으로 서술 (주관적 제안 최소화)
- 각 항목에 상태 표시: ✅ 양호 / ⚠️ 주의 / ❌ 미비
- 수치 데이터를 명확히 제시 (건수, 순위 등)
- "~해야 합니다" 대신 "~로 확인됨", "~가 감지됨" 톤 사용

## 진단 데이터

### 분석 대상
- 업체명: ${businessName}
- 업종: ${industry}
- 종합 점수: ${scoreDesc} → ${overallScore}/100 (${grade}등급 · ${label})

### 네이버 검색 데이터
${naverSection}

### 구글 검색 데이터
${googleSection}

### AI 검색 출력 결과
${aiSection}

### 지역 키워드 검색 노출 현황
${
  localKeywordResult && localKeywordResult.keywords.length > 0
    ? localKeywordResult.keywords
        .map(
          (k) =>
            `- "${k.keyword}": ${k.found ? `${k.position}위에 노출` : "상위 10위 내 미노출"}`,
        )
        .join("\n") + `\n- 지역 키워드 점수: ${localKeywordResult.score}/100`
    : "지역 키워드 검색 데이터를 가져오지 못했습니다."
}

---

위 데이터를 기반으로 다음 구조로 진단 보고서를 작성하세요.

## 📊 종합 진단 결과
- 종합 등급: ${grade}등급 (${overallScore}점/100)
- 네이버 검색 점수: ${naverScore !== null ? `${naverScore}/100` : "데이터 없음"}
- 구글 검색 점수: ${googleScore !== null ? `${googleScore}/100` : "데이터 없음"}
- 진단 요약: (1줄로 현재 온라인 검색 현황을 객관적으로 서술)

## 🔍 네이버 검색 현황
각 카테고리별 상태를 사실 기반으로 서술:
- 웹문서: [건수]건 검색됨 ✅/❌
- 블로그: [건수]건 (상위 노출 콘텐츠 제목/내용 요약, 실제 검색 결과 데이터에서 인용)
- 뉴스: [건수]건 (언론 보도 내용 요약, 있는 경우)
- 카페/커뮤니티: [건수]건
- 플레이스: 등록됨/미등록 ✅/❌
- 각 항목에 점수 세부 내역 반영

## 🌐 구글 검색 현황
- 인덱싱: 확인됨/미확인 ✅/❌
- 검색 순위: N위 (또는 상위 10위 밖)
- 비즈니스 프로필: 등록됨/미등록 ✅/❌
- 리뷰: 있음/없음
- 이미지 검색: 노출됨/미노출

## 📋 항목별 진단표
| 항목 | 상태 | 수치 | 비고 |
|------|------|------|------|
(모든 진단 항목을 표로 정리. 네이버·구글 각 세부 항목 포함)

## 📍 지역 키워드 검색 노출 현황
잠재 고객이 실제로 검색할 지역+업종 키워드로 네이버 블로그 검색 시 업체가 노출되는지 확인.
각 키워드별 노출 여부와 순위를 정리.

## 🤖 AI 검색 출력 결과
각 AI(Gemini, ChatGPT, Claude 중 체크된 항목)에 '${businessName}'를 질문한 결과를 정리.
- AI가 이 업체를 인지하고 있는지
- 제공한 정보가 정확한지
- 업종, 위치, 서비스 설명이 맞는지

## 💡 개선 포인트
현재 미비한 항목을 우선순위 순으로 3-5개 나열.
각 항목은 "~가 미확인 상태로 감지됨" 형식으로 서술하고, 예상 효과를 간략히 병기.

보고서 맨 하단에 다음 면책문구를 반드시 포함하세요:
> ※ 본 분석은 상호명만으로 자동 분석되어 실제와 다를 수 있습니다. 참고용으로 활용해주세요.

보고서 작성 후, 마지막에 다음 형식으로 한 줄 요약을 추가하세요:
SUMMARY: [1-2문장 객관적 진단 요약 — 반드시 점수와 등급 포함]`;
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

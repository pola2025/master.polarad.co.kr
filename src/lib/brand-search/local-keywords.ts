/**
 * 지역 키워드 검색 순위 체크
 * "동대문 어린이축구", "답십리 축구교실" 같은 지역 기반 키워드로
 * 네이버 검색 시 업체가 상위에 노출되는지 확인
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface LocalKeywordResult {
  keyword: string;
  found: boolean;
  position: number | null; // 1-based, null if not found in top 10
  topResults: { title: string; isOwnBrand: boolean }[];
}

export interface LocalKeywordSearchResult {
  keywords: LocalKeywordResult[];
  score: number; // 0-100
  summary: string;
}

// Naver API helper (reuse credentials)
async function searchNaverBlog(
  query: string,
): Promise<{ title: string; description: string }[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const params = new URLSearchParams({
    query,
    display: "10",
    start: "1",
    sort: "sim",
  });

  const res = await fetch(
    `https://openapi.naver.com/v1/search/blog.json?${params}`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    },
  );

  if (!res.ok) return [];
  const data = (await res.json()) as {
    items: { title: string; description: string }[];
  };
  return data.items ?? [];
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
}

// Generate local keywords using Gemini
async function generateKeywords(
  businessName: string,
  industry: string,
  location: string,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash",
  });

  const locationHint = location
    ? `이 업체는 "${location}" 지역에 위치합니다. 반드시 이 지역의 구/동 이름을 사용하세요.`
    : "위치 정보가 없으므로 업종에 맞는 일반적인 지역 키워드를 생성하세요.";

  const prompt = `"${businessName}"은(는) "${industry}" 업종입니다.
${locationHint}

이 업체의 잠재 고객이 네이버에서 검색할 만한 지역+업종 키워드를 3개 생성하세요.

규칙:
- 업체명을 포함하지 말 것 (지역+업종 조합만)
- 실제 한국 소비자가 네이버에서 검색하는 자연스러운 키워드
- 지역명은 반드시 업체 소재지 기준 (구 이름, 동 이름, 인근 랜드마크)
- 예시: "동대문 어린이축구", "답십리 축구교실", "동대문구 유아체육"

JSON 배열만 반환 (마크다운 없이):
["키워드1", "키워드2", "키워드3"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]).slice(0, 3);
  } catch {
    return [];
  }
}

// Check if business appears in search results for a keyword
function checkPresence(
  businessName: string,
  results: { title: string; description: string }[],
): {
  found: boolean;
  position: number | null;
  topResults: { title: string; isOwnBrand: boolean }[];
} {
  const normalizedName = businessName.replace(/\s+/g, "").toLowerCase();

  // Also check partial matches (e.g., "토모" in "토모축구클럽")
  const nameTokens = businessName
    .split(/[\s·]+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.toLowerCase());

  let position: number | null = null;
  const topResults = results.slice(0, 5).map((r, i) => {
    const title = stripHtml(r.title).toLowerCase();
    const desc = stripHtml(r.description).toLowerCase();
    const combined = title + " " + desc;
    const normalizedCombined = combined.replace(/\s+/g, "");

    const isOwnBrand =
      normalizedCombined.includes(normalizedName) ||
      nameTokens.some((t) => combined.includes(t));

    if (isOwnBrand && position === null) {
      position = i + 1;
    }

    return { title: stripHtml(r.title), isOwnBrand };
  });

  return { found: position !== null, position, topResults };
}

export async function searchLocalKeywords(
  businessName: string,
  industry: string,
  location: string = "",
): Promise<LocalKeywordSearchResult> {
  // Step 1: Generate keywords
  const keywords = await generateKeywords(businessName, industry, location);
  if (keywords.length === 0) {
    return { keywords: [], score: 0, summary: "지역 키워드 생성 실패" };
  }

  // Step 2: Search all keywords on Naver in parallel
  const results: LocalKeywordResult[] = await Promise.all(
    keywords.map(async (kw) => {
      const blogResults = await searchNaverBlog(kw);
      const { found, position, topResults } = checkPresence(
        businessName,
        blogResults,
      );
      return { keyword: kw, found, position, topResults };
    }),
  );

  // Step 3: Calculate score
  // Each keyword: found in top 3 = 20pts, top 5 = 15pts, top 10 = 10pts
  const maxPerKeyword = 100 / results.length;
  let totalScore = 0;
  for (const r of results) {
    if (r.position !== null) {
      if (r.position <= 3) totalScore += maxPerKeyword;
      else if (r.position <= 5) totalScore += maxPerKeyword * 0.75;
      else totalScore += maxPerKeyword * 0.5;
    }
  }

  const foundCount = results.filter((r) => r.found).length;
  const summary = `${results.length}개 지역 키워드 중 ${foundCount}개에서 노출 확인`;

  return {
    keywords: results,
    score: Math.round(totalScore),
    summary,
  };
}

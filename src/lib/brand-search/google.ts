import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GoogleSearchResult {
  isIndexed: boolean;
  topRankPosition: number | null;
  hasGoogleBusiness: boolean;
  hasReviews: boolean;
  hasImageResults: boolean;
  reviewCount: number;
  avgRating: number;
  businessCompleteness: number;
  details: string;
  score: number;
  scoreBreakdown: {
    indexed: number;
    topRank: number;
    googleBusiness: number;
    reviews: number;
    imagePresence: number;
  };
}

interface GeminiGroundedResponse {
  isIndexed: boolean;
  topRankPosition: number | null;
  hasGoogleBusiness: boolean;
  hasReviews: boolean;
  hasImageResults: boolean;
  reviewCount: number;
  avgRating: number;
  businessCompleteness: number;
  details: string;
}

function calculateGoogleScore(data: GeminiGroundedResponse): {
  score: number;
  scoreBreakdown: GoogleSearchResult["scoreBreakdown"];
} {
  // Google indexed: 30pts (binary)
  const indexed = data.isIndexed ? 30 : 0;

  // Official site rank: gradient by position
  let topRank = 0;
  if (data.topRankPosition !== null) {
    if (data.topRankPosition === 1) topRank = 25;
    else if (data.topRankPosition === 2) topRank = 22;
    else if (data.topRankPosition === 3) topRank = 20;
    else if (data.topRankPosition <= 5) topRank = 15;
    else if (data.topRankPosition <= 10) topRank = 10;
    else topRank = 5;
  }

  // Google Business Profile: weighted by completeness (0-1 scale)
  const completeness = Math.max(0, Math.min(1, data.businessCompleteness ?? 0));
  const googleBusiness = data.hasGoogleBusiness
    ? Math.round(20 * (completeness > 0 ? completeness : 1))
    : 0;

  // Reviews: log scale weighted by rating
  const reviewCount = Math.max(0, data.reviewCount ?? 0);
  const avgRating = Math.max(0, Math.min(5, data.avgRating ?? 0));
  const reviews = data.hasReviews
    ? Math.min(
        15,
        Math.round(Math.log10(reviewCount + 1) * 5 + (avgRating / 5) * 5),
      )
    : 0;

  // Image search presence: 10pts (binary)
  const imagePresence = data.hasImageResults ? 10 : 0;

  const score = indexed + topRank + googleBusiness + reviews + imagePresence;

  return {
    score,
    scoreBreakdown: {
      indexed,
      topRank,
      googleBusiness,
      reviews,
      imagePresence,
    },
  };
}

export async function searchGoogle(
  businessName: string,
  industry: string,
): Promise<GoogleSearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
  });

  const prompt = `Search Google for the Korean business "${businessName}" in the "${industry}" industry and analyze its online presence.

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "isIndexed": true or false (is the business findable on Google?),
  "topRankPosition": number or null (position of official website in search results, null if not found in top 10),
  "hasGoogleBusiness": true or false (does the business have a Google Business Profile / Google Maps listing?),
  "hasReviews": true or false (does the business have Google reviews?),
  "hasImageResults": true or false (do image search results show branded images for this business?),
  "reviewCount": number (approximate total number of Google reviews, 0 if none),
  "avgRating": number (average Google star rating 0-5, 0 if no reviews),
  "businessCompleteness": number (Google Business Profile completeness from 0 to 1: 0=missing, 0.5=partial info, 1=fully complete with hours/photos/description),
  "details": "A 2-3 sentence summary of the business's Google presence in Korean"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }

    const parsed: GeminiGroundedResponse = JSON.parse(jsonMatch[0]);

    const { score, scoreBreakdown } = calculateGoogleScore(parsed);

    return {
      isIndexed: parsed.isIndexed ?? false,
      topRankPosition: parsed.topRankPosition ?? null,
      hasGoogleBusiness: parsed.hasGoogleBusiness ?? false,
      hasReviews: parsed.hasReviews ?? false,
      hasImageResults: parsed.hasImageResults ?? false,
      reviewCount: parsed.reviewCount ?? 0,
      avgRating: parsed.avgRating ?? 0,
      businessCompleteness: parsed.businessCompleteness ?? 0,
      details: parsed.details ?? "",
      score,
      scoreBreakdown,
    };
  } catch (error) {
    // Return a zero-score result on failure so orchestrator can continue
    const fallbackDetails =
      error instanceof Error
        ? `Google 검색 분석 실패: ${error.message}`
        : "Google 검색 분석 중 알 수 없는 오류가 발생했습니다.";

    return {
      isIndexed: false,
      topRankPosition: null,
      hasGoogleBusiness: false,
      hasReviews: false,
      hasImageResults: false,
      reviewCount: 0,
      avgRating: 0,
      businessCompleteness: 0,
      details: fallbackDetails,
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
}

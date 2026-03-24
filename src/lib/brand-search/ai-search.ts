import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIModelResult {
  model: string;
  knows: boolean;
  accurate: boolean;
  response: string;
  details: {
    nameCorrect: boolean;
    industryCorrect: boolean;
    locationMentioned: boolean;
    descriptionAccurate: boolean;
  };
  error?: string;
}

export interface AISearchResult {
  models: AIModelResult[];
  score: number;
  summary: string;
}

// Single-call prompt: ask about the business AND self-evaluate in one shot
const COMBINED_PROMPT = (name: string, industry: string) =>
  `'${name}'(${industry})에 대해 알고 있는 정보를 알려주세요. 업종, 위치, 주요 서비스를 포함해주세요.

그리고 당신의 응답을 스스로 평가하여, 응답 마지막에 다음 JSON을 추가하세요:
EVAL_JSON: {"knows":true/false,"accurate":true/false,"nameCorrect":true/false,"industryCorrect":true/false,"locationMentioned":true/false,"descriptionAccurate":true/false}

- knows: 이 업체를 실제로 알고 있으면 true (모르면서 추측만 했으면 false)
- accurate: 제공한 정보가 대체로 정확하면 true
- nameCorrect: 업체명을 정확히 언급했으면 true
- industryCorrect: 업종(${industry})이 맞으면 true
- locationMentioned: 위치/지역을 언급했으면 true
- descriptionAccurate: 서비스 설명이 정확하면 true`;

function calculateModelScore(result: AIModelResult): number {
  if (result.error) return 0;
  let score = 0;
  if (result.knows) score += 40;
  if (result.accurate) score += 30;
  if (result.details.nameCorrect) score += 7.5;
  if (result.details.industryCorrect) score += 7.5;
  if (result.details.locationMentioned) score += 7.5;
  if (result.details.descriptionAccurate) score += 7.5;
  return Math.round(score);
}

function parseEvalJson(
  text: string,
): Omit<AIModelResult, "model" | "response" | "error"> {
  const defaults = {
    knows: false,
    accurate: false,
    details: {
      nameCorrect: false,
      industryCorrect: false,
      locationMentioned: false,
      descriptionAccurate: false,
    },
  };

  const match = text.match(/EVAL_JSON:\s*(\{[\s\S]*?\})/);
  if (!match) return defaults;

  try {
    const parsed = JSON.parse(match[1]);
    return {
      knows: parsed.knows ?? false,
      accurate: parsed.accurate ?? false,
      details: {
        nameCorrect: parsed.nameCorrect ?? false,
        industryCorrect: parsed.industryCorrect ?? false,
        locationMentioned: parsed.locationMentioned ?? false,
        descriptionAccurate: parsed.descriptionAccurate ?? false,
      },
    };
  } catch {
    return defaults;
  }
}

async function checkGemini(
  businessName: string,
  industry: string,
  apiKey: string,
): Promise<AIModelResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });
    const result = await model.generateContent(
      COMBINED_PROMPT(businessName, industry),
    );
    const text = result.response.text();
    const evaluation = parseEvalJson(text);
    const responseText = text.replace(/EVAL_JSON:[\s\S]*$/, "").trim();

    return {
      model: "Gemini",
      response: responseText.substring(0, 300),
      ...evaluation,
    };
  } catch (error) {
    return {
      model: "Gemini",
      knows: false,
      accurate: false,
      response: "",
      details: {
        nameCorrect: false,
        industryCorrect: false,
        locationMentioned: false,
        descriptionAccurate: false,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchAI(
  businessName: string,
  industry: string,
): Promise<AISearchResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return { models: [], score: 0, summary: "AI 검색 불가 (API 키 없음)" };
  }

  // Currently Gemini only (single call, fast)
  const geminiResult = await checkGemini(businessName, industry, geminiKey);
  const models = [geminiResult];

  const validModels = models.filter((m) => !m.error);
  const totalScore =
    validModels.length > 0
      ? Math.round(
          validModels.reduce((sum, m) => sum + calculateModelScore(m), 0) /
            validModels.length,
        )
      : 0;

  const knowsCount = validModels.filter((m) => m.knows).length;
  const checkedNames = models.map((m) => m.model).join(", ");
  const summary =
    validModels.length === 0
      ? "AI 검색 체크 실패"
      : knowsCount > 0
        ? `${checkedNames} 중 ${knowsCount}개 인지`
        : `${checkedNames}에서 미인지`;

  return { models, score: totalScore, summary };
}

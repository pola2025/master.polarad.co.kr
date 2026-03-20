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

const QUESTION_PROMPT = (name: string) =>
  `'${name}'에 대해 알려주세요. 이 업체의 업종, 위치, 주요 서비스를 알려주세요. 모르면 모른다고 답해주세요.`;

const EVAL_PROMPT = (
  name: string,
  industry: string,
  response: string,
) => `다음은 '${name}'(${industry})에 대한 AI의 응답입니다. 이 응답의 정확성을 평가하세요.

AI 응답:
"""
${response}
"""

다음 JSON만 반환하세요 (마크다운 없이):
{
  "knows": true/false (AI가 이 업체를 실제로 알고 있는지, 모른다고 하거나 일반적인 추측만 했으면 false),
  "accurate": true/false (제공한 정보가 대체로 정확한지),
  "nameCorrect": true/false (업체명을 정확히 언급했는지),
  "industryCorrect": true/false (업종이 맞는지),
  "locationMentioned": true/false (위치/지역을 언급했는지),
  "descriptionAccurate": true/false (서비스 설명이 정확한지)
}`;

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

async function askGemini(
  businessName: string,
  apiKey: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
  });
  const result = await model.generateContent(QUESTION_PROMPT(businessName));
  return result.response.text().substring(0, 600);
}

async function askChatGPT(
  businessName: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: QUESTION_PROMPT(businessName) }],
      max_tokens: 300,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").substring(0, 600);
}

async function askClaude(
  businessName: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: QUESTION_PROMPT(businessName) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  return text.substring(0, 600);
}

async function evaluateResponse(
  businessName: string,
  industry: string,
  response: string,
  apiKey: string,
): Promise<Omit<AIModelResult, "model" | "response" | "error">> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
  });

  const result = await model.generateContent(
    EVAL_PROMPT(businessName, industry, response),
  );
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      knows: false,
      accurate: false,
      details: {
        nameCorrect: false,
        industryCorrect: false,
        locationMentioned: false,
        descriptionAccurate: false,
      },
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
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
}

async function checkModel(
  modelName: string,
  askFn: () => Promise<string>,
  businessName: string,
  industry: string,
  geminiApiKey: string,
): Promise<AIModelResult> {
  try {
    const response = await askFn();
    const evaluation = await evaluateResponse(
      businessName,
      industry,
      response,
      geminiApiKey,
    );
    return {
      model: modelName,
      response: response.substring(0, 300),
      ...evaluation,
    };
  } catch (error) {
    return {
      model: modelName,
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

  // Build list of models to check
  const checks: Promise<AIModelResult>[] = [];

  // Gemini (always available)
  checks.push(
    checkModel(
      "Gemini",
      () => askGemini(businessName, geminiKey),
      businessName,
      industry,
      geminiKey,
    ),
  );

  // ChatGPT (optional)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    checks.push(
      checkModel(
        "ChatGPT",
        () => askChatGPT(businessName, openaiKey),
        businessName,
        industry,
        geminiKey,
      ),
    );
  }

  // Claude (optional)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    checks.push(
      checkModel(
        "Claude",
        () => askClaude(businessName, anthropicKey),
        businessName,
        industry,
        geminiKey,
      ),
    );
  }

  const models = await Promise.all(checks);

  // Calculate overall score
  const validModels = models.filter((m) => !m.error);
  const totalScore =
    validModels.length > 0
      ? Math.round(
          validModels.reduce((sum, m) => sum + calculateModelScore(m), 0) /
            validModels.length,
        )
      : 0;

  // Generate summary
  const knowsCount = validModels.filter((m) => m.knows).length;
  const accurateCount = validModels.filter((m) => m.accurate).length;
  const checkedNames = models.map((m) => m.model).join(", ");
  const summary =
    validModels.length === 0
      ? "AI 검색 체크 실패"
      : `${checkedNames} 중 ${knowsCount}개 인지, ${accurateCount}개 정확`;

  return { models, score: totalScore, summary };
}

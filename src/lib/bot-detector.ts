/**
 * 서버사이드 봇 탐지
 * User-Agent 기반으로 봇/크롤러 식별
 */

// 알려진 봇 패턴 (정규표현식)
const BOT_PATTERNS = [
  // 검색엔진 크롤러
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /duckduckbot/i,
  /slurp/i, // Yahoo
  /naverbot/i,
  /yeti/i, // Naver
  /daum/i,
  /sogou/i,

  // SEO/모니터링 도구
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /screaming frog/i,
  /seokicks/i,

  // 소셜 미디어 크롤러
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  /kakaotalk-scrap/i,

  // 일반 봇/크롤러
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /wget/i,
  /curl\//i,
  /httpx/i,
  /python-requests/i,
  /go-http-client/i,
  /java\//i,
  /libwww/i,
  /fetch\//i,
  /axios/i,
  /node-fetch/i,
  /undici/i,

  // 보안 스캐너
  /nmap/i,
  /nikto/i,
  /sqlmap/i,
  /masscan/i,
  /zgrab/i,
  /censys/i,

  // 기타
  /uptimerobot/i,
  /pingdom/i,
  /site24x7/i,
  /statuscake/i,
  /gtmetrix/i,
  /pagespeed/i,
  /lighthouse/i,
];

// 봇 카테고리 분류
const BOT_CATEGORIES: Record<string, RegExp[]> = {
  검색엔진: [
    /googlebot/i,
    /bingbot/i,
    /yandexbot/i,
    /baiduspider/i,
    /duckduckbot/i,
    /slurp/i,
    /naverbot/i,
    /yeti/i,
    /daum/i,
  ],
  소셜미디어: [
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /discordbot/i,
    /slackbot/i,
    /kakaotalk/i,
  ],
  SEO도구: [
    /semrushbot/i,
    /ahrefsbot/i,
    /mj12bot/i,
    /dotbot/i,
    /rogerbot/i,
    /screaming frog/i,
  ],
  모니터링: [
    /uptimerobot/i,
    /pingdom/i,
    /site24x7/i,
    /statuscake/i,
    /gtmetrix/i,
    /pagespeed/i,
    /lighthouse/i,
  ],
  스크래퍼: [
    /headless/i,
    /phantom/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
    /python-requests/i,
    /go-http-client/i,
    /wget/i,
    /curl\//i,
  ],
  보안스캐너: [/nmap/i, /nikto/i, /sqlmap/i, /masscan/i, /zgrab/i, /censys/i],
};

export interface BotDetectionResult {
  isBot: boolean;
  botName: string | null;
  category: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * User-Agent 문자열로 봇 여부 판별
 */
export function detectBot(userAgent: string | null): BotDetectionResult {
  if (!userAgent || userAgent.length < 10) {
    return {
      isBot: true,
      botName: "Empty UA",
      category: "스크래퍼",
      confidence: "high",
    };
  }

  // 패턴 매칭
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      const match = userAgent.match(pattern);
      const botName = match ? match[0] : "Unknown Bot";

      // 카테고리 분류
      let category = "기타";
      for (const [cat, patterns] of Object.entries(BOT_CATEGORIES)) {
        if (patterns.some((p) => p.test(userAgent))) {
          category = cat;
          break;
        }
      }

      return { isBot: true, botName, category, confidence: "high" };
    }
  }

  // 의심스러운 패턴 (낮은 확신도)
  if (!userAgent.includes("Mozilla") && !userAgent.includes("Opera")) {
    return {
      isBot: true,
      botName: "Non-browser UA",
      category: "기타",
      confidence: "medium",
    };
  }

  return { isBot: false, botName: null, category: null, confidence: "high" };
}

/**
 * 봇 통계용 간단 요약
 */
export function getBotSummary(userAgent: string | null): {
  isBot: boolean;
  category: string;
} {
  const result = detectBot(userAgent);
  return {
    isBot: result.isBot,
    category: result.category || "일반방문자",
  };
}

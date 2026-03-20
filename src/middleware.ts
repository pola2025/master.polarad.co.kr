import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 차단할 국가 코드
const BLOCKED_COUNTRIES = ["CN"];

// 인증 없이 접근 가능한 경로
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/cron/",
  "/api/brand-reports/",
  "/api/analytics/bot-stats",
];

// 봇 탐지 패턴 (간소화 버전 - middleware에서 사용)
const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /naverbot/i,
  /yeti/i,
  /daum/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  /kakaotalk/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /wget/i,
  /curl\//i,
  /python-requests/i,
  /go-http-client/i,
  /uptimerobot/i,
  /pingdom/i,
  /gtmetrix/i,
  /lighthouse/i,
  /nmap/i,
  /nikto/i,
  /sqlmap/i,
  /zgrab/i,
  /censys/i,
];

const BOT_CATEGORY_MAP: [RegExp[], string][] = [
  [
    [
      /googlebot/i,
      /bingbot/i,
      /yandexbot/i,
      /baiduspider/i,
      /naverbot/i,
      /yeti/i,
      /daum/i,
    ],
    "검색엔진",
  ],
  [
    [
      /facebookexternalhit/i,
      /twitterbot/i,
      /linkedinbot/i,
      /telegrambot/i,
      /discordbot/i,
      /slackbot/i,
      /kakaotalk/i,
    ],
    "소셜미디어",
  ],
  [[/semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i], "SEO도구"],
  [[/uptimerobot/i, /pingdom/i, /gtmetrix/i, /lighthouse/i], "모니터링"],
  [
    [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /puppeteer/i,
      /wget/i,
      /curl\//i,
      /python-requests/i,
      /go-http-client/i,
    ],
    "스크래퍼",
  ],
  [[/nmap/i, /nikto/i, /sqlmap/i, /zgrab/i, /censys/i], "보안스캐너"],
];

function detectBotFromUA(ua: string): {
  isBot: boolean;
  botName: string;
  category: string;
} {
  if (!ua || ua.length < 10)
    return { isBot: true, botName: "Empty UA", category: "스크래퍼" };

  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      const match = ua.match(pattern);
      const botName = match ? match[0] : "Unknown";
      let category = "기타";
      for (const [patterns, cat] of BOT_CATEGORY_MAP) {
        if (patterns.some((p) => p.test(ua))) {
          category = cat;
          break;
        }
      }
      return { isBot: true, botName, category };
    }
  }

  if (!ua.includes("Mozilla") && !ua.includes("Opera")) {
    return { isBot: true, botName: "Non-browser", category: "기타" };
  }

  return { isBot: false, botName: "", category: "" };
}

export function middleware(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || "";
  const pathname = request.nextUrl.pathname;

  // 중국 IP 차단 (공개 경로 포함)
  if (BLOCKED_COUNTRIES.includes(country)) {
    return new NextResponse("Access Denied", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 공개 경로 통과
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 정적 파일 통과
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 봇 탐지 & 로깅 (비차단 - 페이지 요청만)
  const userAgent = request.headers.get("user-agent") || "";
  const botResult = detectBotFromUA(userAgent);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // 비동기로 봇 통계 API에 기록 (응답 차단 없음)
  if (!pathname.startsWith("/api/")) {
    const botStatsUrl = new URL("/api/analytics/bot-stats", request.url);
    fetch(botStatsUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isBot: botResult.isBot,
        botName: botResult.botName,
        category: botResult.category,
        path: pathname,
        ip,
      }),
    }).catch(() => {}); // 실패해도 무시
  }

  // 토큰 확인 → 없으면 로그인 페이지로
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

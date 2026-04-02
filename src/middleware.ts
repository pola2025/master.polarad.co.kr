import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// 내부 API 키 (미들웨어 → bot-stats 통신)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

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
  "/api/send-email",
  "/report/",
  "/api/report/",
  "/api/webhook/",
  "/api/email-tracking/",
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

// 공격 패턴 차단 (NoSQL injection, path traversal 등)
const ATTACK_PATTERNS = [
  /\$ne/i,
  /\$gt/i,
  /\$lt/i,
  /\$regex/i,
  /\$where/i,
  /\.\.\//,
  /<script/i,
  /union\s+select/i,
  /eval\(/i,
];

function fullyDecode(str: string): string {
  let prev = str;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(prev);
      if (decoded === prev) return decoded;
      prev = decoded;
    } catch {
      return prev;
    }
  }
  return prev;
}

function isAttackRequest(url: string): boolean {
  const decoded = fullyDecode(url);
  for (const pattern of ATTACK_PATTERNS) {
    if (pattern.test(decoded)) return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || "";
  const pathname = request.nextUrl.pathname;
  const fullUrl = request.nextUrl.toString();

  // 공격 패턴 차단 (쿼리스트링 포함)
  if (isAttackRequest(fullUrl)) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    console.warn(`[WAF] 공격 차단 (IP: ${ip}): ${pathname}`);
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

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
      headers: {
        "Content-Type": "application/json",
        ...(INTERNAL_API_KEY ? { "x-internal-key": INTERNAL_API_KEY } : {}),
      },
      body: JSON.stringify({
        isBot: botResult.isBot,
        botName: botResult.botName,
        category: botResult.category,
        path: pathname,
        ip,
      }),
    }).catch(() => {}); // 실패해도 무시
  }

  // JWT 토큰 검증 → 없거나 무효하면 로그인 페이지로
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // JWT 유효성 검증 (서명 + 만료)
  try {
    const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
    if (!secret) {
      console.error("[middleware] JWT_SECRET/ADMIN_PASSWORD 환경변수 미설정");
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    const secretKey = new TextEncoder().encode(secret);
    await jwtVerify(token, secretKey);
  } catch {
    // 만료되었거나 위조된 토큰
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("admin_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

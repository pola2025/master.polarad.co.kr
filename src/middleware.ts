import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 차단할 국가 코드
const BLOCKED_COUNTRIES = [
  "CN", // 중국
]

// 차단 제외 경로 (API 등 필요한 경우)
const EXCLUDED_PATHS = [
  "/api/cron/", // cron job은 허용
]

export function middleware(request: NextRequest) {
  // 국가 정보 가져오기 (Vercel 헤더에서)
  const country = request.headers.get("x-vercel-ip-country") || ""
  const pathname = request.nextUrl.pathname

  // 제외 경로 체크
  const isExcluded = EXCLUDED_PATHS.some((path) => pathname.startsWith(path))
  if (isExcluded) {
    return NextResponse.next()
  }

  // 차단 국가 체크
  if (BLOCKED_COUNTRIES.includes(country)) {
    // 403 Forbidden 반환
    return new NextResponse("Access Denied", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  // 정적 파일 제외, 모든 페이지에 적용
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

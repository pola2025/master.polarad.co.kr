import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 차단할 국가 코드
const BLOCKED_COUNTRIES = ["CN"]

// 인증 없이 접근 가능한 경로
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/cron/",
]

export function middleware(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || ""
  const pathname = request.nextUrl.pathname

  // 중국 IP 차단 (공개 경로 포함)
  if (BLOCKED_COUNTRIES.includes(country)) {
    return new NextResponse("Access Denied", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    })
  }

  // 공개 경로 통과
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 정적 파일 통과
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // 토큰 확인 → 없으면 로그인 페이지로
  const token = request.cookies.get("admin_token")?.value
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

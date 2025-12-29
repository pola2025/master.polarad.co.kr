import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 보호할 경로 패턴
const protectedPaths = [
  "/",
  "/analytics",
  "/analytics/insights",
  "/analytics/keywords",
  "/analytics/campaigns",
  "/content",
  "/inquiries",
  "/settings",
]

// 공개 경로 (로그인 불필요)
const publicPaths = ["/login", "/api/auth/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API 경로는 인증 API 제외하고 통과
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    return NextResponse.next()
  }

  // 정적 파일 및 Next.js 내부 경로 통과
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // 공개 경로는 통과
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"))) {
    return NextResponse.next()
  }

  // 세션 쿠키 확인
  const sessionCookie = request.cookies.get("admin_session")

  // 세션이 없으면 로그인 페이지로 리다이렉트
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 세션이 있으면 통과
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}

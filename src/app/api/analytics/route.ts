import { NextResponse } from "next/server"
import { getDashboardData } from "@/lib/google-analytics"

export async function GET() {
  try {
    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      // 개발 환경에서는 더미 데이터 반환
      return NextResponse.json({
        overview: {
          totalUsers: 198,
          newUsers: 87,
          sessions: 245,
          pageViews: 334,
          bounceRate: 42.3,
          avgSessionDuration: 154, // seconds
          changes: {
            users: 12.5,
            pageViews: 8.2,
            bounceRate: -5.4,
            avgSessionDuration: -3.1,
          },
        },
        daily: [
          { date: "12/14", visitors: 186, pageviews: 312 },
          { date: "12/15", visitors: 305, pageviews: 521 },
          { date: "12/16", visitors: 237, pageviews: 408 },
          { date: "12/17", visitors: 173, pageviews: 289 },
          { date: "12/18", visitors: 209, pageviews: 367 },
          { date: "12/19", visitors: 264, pageviews: 445 },
          { date: "12/20", visitors: 198, pageviews: 334 },
        ],
        sources: [
          { source: "direct", visitors: 450 },
          { source: "organic", visitors: 380 },
          { source: "referral", visitors: 220 },
          { source: "social", visitors: 150 },
        ],
        pages: [
          { path: "/", title: "홈", views: 1234, avgTime: "2:34" },
          { path: "/service", title: "서비스 소개", views: 856, avgTime: "3:12" },
          { path: "/marketing-news", title: "마케팅 뉴스", views: 623, avgTime: "4:21" },
          { path: "/contact", title: "문의하기", views: 412, avgTime: "1:45" },
          { path: "/portfolio", title: "포트폴리오", views: 287, avgTime: "2:58" },
        ],
        devices: [
          { device: "mobile", visitors: 680 },
          { device: "desktop", visitors: 450 },
          { device: "tablet", visitors: 70 },
        ],
        isDemoData: true,
      })
    }

    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    )
  }
}

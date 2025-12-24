import { NextRequest, NextResponse } from "next/server"
import { getVisitorStatsData } from "@/lib/google-analytics"

// 빈 데이터 (API 미설정 시)
const EMPTY_DATA = {
  overview: {
    totalVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    avgSessionDuration: "0분 0초",
    bounceRate: 0,
    newVisitors: 0,
    returningVisitors: 0,
    changes: {
      visitors: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    },
  },
  daily: [],
  countries: [],
  pages: [],
  devices: [],
  browsers: [],
  hourlyTraffic: [],
}

export async function GET(request: NextRequest) {
  try {
    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(EMPTY_DATA)
    }

    // 쿼리 파라미터에서 days 추출 (기본값 7일)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "7", 10)

    const data = await getVisitorStatsData(days)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Visitors API Error:", error)
    // 에러 발생 시 빈 데이터 반환
    return NextResponse.json(EMPTY_DATA)
  }
}

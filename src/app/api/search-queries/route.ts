import { NextRequest, NextResponse } from "next/server"
import {
  getSearchQueries,
  getSearchQueriesByDateRange,
  getCumulativeSearchQueries
} from "@/lib/search-console"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get("period") || "weekly" // weekly, monthly, cumulative, custom
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const limit = parseInt(searchParams.get("limit") || "10")

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "API not configured", message: "데이터 수집 준비 중입니다." },
        { status: 501 }
      )
    }

    let data

    switch (period) {
      case "weekly":
        data = await getSearchQueries(7)
        break
      case "monthly":
        data = await getSearchQueries(30)
        break
      case "cumulative":
        data = await getCumulativeSearchQueries(limit)
        break
      case "custom":
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: "Missing date range", message: "시작일과 종료일이 필요합니다." },
            { status: 400 }
          )
        }
        data = await getSearchQueriesByDateRange(startDate, endDate, limit)
        break
      default:
        data = await getSearchQueries(7)
    }

    return NextResponse.json({
      ...data,
      period,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
  } catch (error) {
    console.error("Search Console API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch search queries" },
      { status: 500 }
    )
  }
}

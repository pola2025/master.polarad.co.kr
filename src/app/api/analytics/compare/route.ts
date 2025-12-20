import { NextRequest, NextResponse } from "next/server"
import { getCompareData } from "@/lib/google-analytics"

// 날짜 포맷 함수
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // 기간 파라미터 파싱
    let currentStart = searchParams.get("current_start")
    let currentEnd = searchParams.get("current_end")
    let previousStart = searchParams.get("previous_start")
    let previousEnd = searchParams.get("previous_end")
    const preset = searchParams.get("preset") // "week", "month" 프리셋

    const today = new Date()

    // 프리셋 처리
    if (preset === "week" || (!currentStart && !preset)) {
      // 이번 주 vs 지난 주
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // 월요일
      const thisWeekEnd = today

      const lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekEnd = new Date(thisWeekStart)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)

      currentStart = formatDate(thisWeekStart)
      currentEnd = formatDate(thisWeekEnd)
      previousStart = formatDate(lastWeekStart)
      previousEnd = formatDate(lastWeekEnd)
    } else if (preset === "month") {
      // 이번 달 vs 지난 달
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const thisMonthEnd = today

      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

      currentStart = formatDate(thisMonthStart)
      currentEnd = formatDate(thisMonthEnd)
      previousStart = formatDate(lastMonthStart)
      previousEnd = formatDate(lastMonthEnd)
    }

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return NextResponse.json(
        { error: "Missing date parameters" },
        { status: 400 }
      )
    }

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      )
    }

    // 실제 GA4 API 호출
    const data = await getCompareData(currentStart, currentEnd, previousStart, previousEnd)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Compare Analytics API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch comparison data" },
      { status: 500 }
    )
  }
}

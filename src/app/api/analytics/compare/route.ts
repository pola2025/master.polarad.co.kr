import { NextRequest, NextResponse } from "next/server"
import type { PeriodCompareData, PeriodMetrics } from "@/types/analytics"

// 데모 데이터 생성 함수
function generateDemoCompareData(
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): PeriodCompareData {
  const currentDays = Math.ceil(
    (new Date(currentEnd).getTime() - new Date(currentStart).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  const baseVisitors = currentDays * 280
  const variance = () => (Math.random() - 0.5) * 0.2 // -10% ~ +10%

  const current: PeriodMetrics & { startDate: string; endDate: string } = {
    startDate: currentStart,
    endDate: currentEnd,
    visitors: Math.floor(baseVisitors * (1 + variance())),
    pageviews: Math.floor(baseVisitors * 3 * (1 + variance())),
    sessions: Math.floor(baseVisitors * 1.2 * (1 + variance())),
    bounceRate: 38 + Math.random() * 10,
    avgDuration: 180 + Math.random() * 60,
    newUsers: Math.floor(baseVisitors * 0.6 * (1 + variance())),
    returningUsers: Math.floor(baseVisitors * 0.4 * (1 + variance())),
  }

  const previous: PeriodMetrics & { startDate: string; endDate: string } = {
    startDate: previousStart,
    endDate: previousEnd,
    visitors: Math.floor(baseVisitors * 0.9 * (1 + variance())),
    pageviews: Math.floor(baseVisitors * 2.8 * (1 + variance())),
    sessions: Math.floor(baseVisitors * 1.1 * (1 + variance())),
    bounceRate: 40 + Math.random() * 10,
    avgDuration: 170 + Math.random() * 60,
    newUsers: Math.floor(baseVisitors * 0.55 * (1 + variance())),
    returningUsers: Math.floor(baseVisitors * 0.35 * (1 + variance())),
  }

  const calculateChange = (curr: number, prev: number) => {
    if (prev === 0) return 0
    return ((curr - prev) / prev) * 100
  }

  return {
    current,
    previous,
    changes: {
      visitors_percent: calculateChange(current.visitors, previous.visitors),
      pageviews_percent: calculateChange(current.pageviews, previous.pageviews),
      sessions_percent: calculateChange(current.sessions, previous.sessions),
      bounceRate_percent: calculateChange(current.bounceRate, previous.bounceRate),
      avgDuration_percent: calculateChange(current.avgDuration, previous.avgDuration),
      newUsers_percent: calculateChange(current.newUsers, previous.newUsers),
    },
  }
}

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
      const demoData = generateDemoCompareData(
        currentStart,
        currentEnd,
        previousStart,
        previousEnd
      )
      return NextResponse.json({ ...demoData, isDemoData: true })
    }

    // 실제 GA4 API 호출 (추후 구현)
    const demoData = generateDemoCompareData(
      currentStart,
      currentEnd,
      previousStart,
      previousEnd
    )
    return NextResponse.json(demoData)
  } catch (error) {
    console.error("Compare Analytics API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch comparison data" },
      { status: 500 }
    )
  }
}

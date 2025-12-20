import { NextRequest, NextResponse } from "next/server"
import { getAggregatedVisitorData } from "@/lib/google-analytics"
import {
  getDailyAnalyticsFromCache,
  isCacheValid,
  CACHE_KEYS,
} from "@/lib/airtable-cache"
import type { AggregatedVisitorData, DailyVisitorData, WeeklyVisitorData, MonthlyVisitorData } from "@/types/analytics"

// 데모 데이터 생성 함수
function generateDemoData(days: number): AggregatedVisitorData {
  const daily: DailyVisitorData[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const baseVisitors = isWeekend ? 150 : 280
    const variation = Math.floor(Math.random() * 80) - 40

    daily.push({
      date: dateStr,
      visitors: Math.max(50, baseVisitors + variation),
      pageviews: Math.max(100, (baseVisitors + variation) * 3),
      sessions: Math.max(60, Math.floor((baseVisitors + variation) * 1.2)),
      newUsers: Math.max(30, Math.floor((baseVisitors + variation) * 0.6)),
      bounceRate: 35 + Math.random() * 15,
      avgDuration: 120 + Math.random() * 120,
    })
  }

  const weekly = aggregateToWeekly(daily)
  const monthly = aggregateToMonthly(daily, weekly)
  const summary = calculateSummary(daily)

  return { daily, weekly, monthly, summary }
}

// 주 시작일 계산 (월요일 기준)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

// 주 번호 계산
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `W${weekNum.toString().padStart(2, "0")}`
}

// 변화율 계산
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

// 일별 -> 주별 집계
function aggregateToWeekly(daily: DailyVisitorData[]): WeeklyVisitorData[] {
  const weeklyMap = new Map<string, DailyVisitorData[]>()

  for (const day of daily) {
    const date = new Date(day.date)
    const weekStart = getWeekStart(date)
    const weekKey = weekStart.toISOString().split("T")[0]

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, [])
    }
    weeklyMap.get(weekKey)!.push(day)
  }

  const weeks: WeeklyVisitorData[] = Array.from(weeklyMap.entries())
    .map(([weekStartStr, days]) => {
      const weekStart = new Date(weekStartStr)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      return {
        week_label: getWeekNumber(weekStart),
        week_start: weekStartStr,
        week_end: weekEnd.toISOString().split("T")[0],
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0 ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length : 0,
        avgDuration: days.length > 0 ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length : 0,
      }
    })
    .sort((a, b) => b.week_start.localeCompare(a.week_start))

  // 전주 대비 변화율 계산
  for (let i = 0; i < weeks.length - 1; i++) {
    weeks[i].visitors_change = calculateChange(weeks[i].visitors, weeks[i + 1].visitors)
    weeks[i].pageviews_change = calculateChange(weeks[i].pageviews, weeks[i + 1].pageviews)
    weeks[i].sessions_change = calculateChange(weeks[i].sessions, weeks[i + 1].sessions)
    weeks[i].bounceRate_change = calculateChange(weeks[i].bounceRate, weeks[i + 1].bounceRate)
  }

  return weeks
}

// 일별 -> 월별 집계
function aggregateToMonthly(daily: DailyVisitorData[], weekly: WeeklyVisitorData[]): MonthlyVisitorData[] {
  const monthlyMap = new Map<string, DailyVisitorData[]>()

  for (const day of daily) {
    const month = day.date.substring(0, 7)
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, [])
    }
    monthlyMap.get(month)!.push(day)
  }

  const months: MonthlyVisitorData[] = Array.from(monthlyMap.entries())
    .map(([month, days]) => {
      const [year, m] = month.split("-")
      const monthLabel = `${year}년 ${parseInt(m)}월`

      const monthWeeks = weekly.filter(
        (w) => w.week_start.startsWith(month) || w.week_end.startsWith(month)
      )

      return {
        month,
        month_label: monthLabel,
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0 ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length : 0,
        avgDuration: days.length > 0 ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length : 0,
        weeks: monthWeeks,
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month))

  // 전월 대비 변화율 계산
  for (let i = 0; i < months.length - 1; i++) {
    months[i].visitors_change = calculateChange(months[i].visitors, months[i + 1].visitors)
    months[i].pageviews_change = calculateChange(months[i].pageviews, months[i + 1].pageviews)
    months[i].sessions_change = calculateChange(months[i].sessions, months[i + 1].sessions)
    months[i].bounceRate_change = calculateChange(months[i].bounceRate, months[i + 1].bounceRate)
  }

  return months
}

// 요약 계산
function calculateSummary(daily: DailyVisitorData[]) {
  return {
    total_visitors: daily.reduce((sum, d) => sum + d.visitors, 0),
    total_pageviews: daily.reduce((sum, d) => sum + d.pageviews, 0),
    total_sessions: daily.reduce((sum, d) => sum + d.sessions, 0),
    avg_bounce_rate: daily.length > 0 ? daily.reduce((sum, d) => sum + d.bounceRate, 0) / daily.length : 0,
    avg_session_duration: daily.length > 0 ? daily.reduce((sum, d) => sum + d.avgDuration, 0) / daily.length : 0,
    date_range: {
      start: daily.length > 0 ? daily[daily.length - 1].date : "",
      end: daily.length > 0 ? daily[0].date : "",
    },
  }
}

// 메모리 캐시 (Airtable 캐시가 없을 때 fallback)
let memoryCachedData: AggregatedVisitorData | null = null
let memoryCacheTime: number = 0
const MEMORY_CACHE_DURATION = 60 * 60 * 1000 // 1시간

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "90")
    const forceRefresh = searchParams.get("refresh") === "true"

    // 환경 변수 확인 - Google 설정 없으면 데모 데이터
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      const demoData = generateDemoData(days)
      return NextResponse.json({
        ...demoData,
        isDemoData: true,
      })
    }

    // Airtable 캐시 확인 (강제 새로고침이 아닌 경우)
    if (!forceRefresh && process.env.AIRTABLE_API_TOKEN) {
      try {
        const cacheValid = await isCacheValid(CACHE_KEYS.DAILY_ANALYTICS, 24) // 24시간 유효

        if (cacheValid) {
          console.log("[API] Using Airtable cache for daily analytics")
          const cachedDaily = await getDailyAnalyticsFromCache(days)

          if (cachedDaily.length > 0) {
            const weekly = aggregateToWeekly(cachedDaily)
            const monthly = aggregateToMonthly(cachedDaily, weekly)
            const summary = calculateSummary(cachedDaily)

            return NextResponse.json({
              daily: cachedDaily,
              weekly,
              monthly,
              summary,
              fromCache: true,
            })
          }
        }
      } catch (cacheError) {
        console.error("[API] Airtable cache error:", cacheError)
        // 캐시 오류 시 계속 진행
      }
    }

    // 메모리 캐시 확인
    const now = Date.now()
    if (!forceRefresh && memoryCachedData && now - memoryCacheTime < MEMORY_CACHE_DURATION) {
      console.log("[API] Using memory cache for daily analytics")
      return NextResponse.json({
        ...memoryCachedData,
        fromMemoryCache: true,
      })
    }

    // Google API에서 데이터 조회
    console.log("[API] Fetching from Google Analytics API")
    const data = await getAggregatedVisitorData(days)

    // 메모리 캐시 저장
    memoryCachedData = data
    memoryCacheTime = now

    return NextResponse.json(data)
  } catch (error) {
    console.error("Aggregated Analytics API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch aggregated analytics data" },
      { status: 500 }
    )
  }
}

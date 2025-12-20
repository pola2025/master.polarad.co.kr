import { BetaAnalyticsDataClient } from "@google-analytics/data"

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "514776969"

// 서비스 계정 인증 설정
function getAnalyticsClient() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google Analytics credentials not configured")
  }

  return new BetaAnalyticsDataClient({
    credentials,
  })
}

// 날짜 포맷 함수
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

// 오늘 기준 n일 전 날짜
function getDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDate(date)
}

export interface AnalyticsOverview {
  totalUsers: number
  newUsers: number
  sessions: number
  pageViews: number
  bounceRate: number
  avgSessionDuration: number
}

export interface DailyMetrics {
  date: string
  visitors: number
  pageviews: number
}

export interface TrafficSource {
  source: string
  visitors: number
}

export interface TopPage {
  path: string
  title: string
  views: number
  avgTime: string
}

export interface DeviceCategory {
  device: string
  visitors: number
}

// 오늘 데이터 조회
export async function getTodayOverview(): Promise<AnalyticsOverview> {
  const client = getAnalyticsClient()
  const today = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: today, endDate: today }],
    metrics: [
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
  })

  const row = response.rows?.[0]
  const values = row?.metricValues || []

  return {
    totalUsers: parseInt(values[0]?.value || "0"),
    newUsers: parseInt(values[1]?.value || "0"),
    sessions: parseInt(values[2]?.value || "0"),
    pageViews: parseInt(values[3]?.value || "0"),
    bounceRate: parseFloat(values[4]?.value || "0") * 100,
    avgSessionDuration: parseFloat(values[5]?.value || "0"),
  }
}

// 어제 데이터 조회 (비교용)
export async function getYesterdayOverview(): Promise<AnalyticsOverview> {
  const client = getAnalyticsClient()
  const yesterday = getDaysAgo(1)

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: yesterday, endDate: yesterday }],
    metrics: [
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
  })

  const row = response.rows?.[0]
  const values = row?.metricValues || []

  return {
    totalUsers: parseInt(values[0]?.value || "0"),
    newUsers: parseInt(values[1]?.value || "0"),
    sessions: parseInt(values[2]?.value || "0"),
    pageViews: parseInt(values[3]?.value || "0"),
    bounceRate: parseFloat(values[4]?.value || "0") * 100,
    avgSessionDuration: parseFloat(values[5]?.value || "0"),
  }
}

// 일별 방문자 추이 (최근 7일)
export async function getDailyMetrics(days: number = 7): Promise<DailyMetrics[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(days - 1)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  })

  return (response.rows || []).map((row) => {
    const dateStr = row.dimensionValues?.[0]?.value || ""
    // YYYYMMDD -> MM/DD 형식으로 변환
    const formatted = `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`
    return {
      date: formatted,
      visitors: parseInt(row.metricValues?.[0]?.value || "0"),
      pageviews: parseInt(row.metricValues?.[1]?.value || "0"),
    }
  })
}

// 유입 경로별 방문자
export async function getTrafficSources(): Promise<TrafficSource[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(6)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 5,
  })

  const sourceMapping: Record<string, string> = {
    "Direct": "direct",
    "Organic Search": "organic",
    "Referral": "referral",
    "Organic Social": "social",
    "Paid Search": "paid",
    "Email": "email",
  }

  return (response.rows || []).map((row) => {
    const sourceName = row.dimensionValues?.[0]?.value || "Other"
    return {
      source: sourceMapping[sourceName] || sourceName.toLowerCase(),
      visitors: parseInt(row.metricValues?.[0]?.value || "0"),
    }
  })
}

// 인기 페이지 Top 5
export async function getTopPages(): Promise<TopPage[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(6)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "pagePath" },
      { name: "pageTitle" },
    ],
    metrics: [
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 5,
  })

  return (response.rows || []).map((row) => {
    const duration = parseFloat(row.metricValues?.[1]?.value || "0")
    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)

    return {
      path: row.dimensionValues?.[0]?.value || "/",
      title: row.dimensionValues?.[1]?.value || "홈",
      views: parseInt(row.metricValues?.[0]?.value || "0"),
      avgTime: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    }
  })
}

// 기기별 분포
export async function getDeviceCategories(): Promise<DeviceCategory[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(6)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
  })

  return (response.rows || []).map((row) => ({
    device: row.dimensionValues?.[0]?.value || "unknown",
    visitors: parseInt(row.metricValues?.[0]?.value || "0"),
  }))
}

// =====================
// 누적데이터 집계 함수
// =====================

import type {
  DailyVisitorData,
  WeeklyVisitorData,
  MonthlyVisitorData,
  AggregatedVisitorData,
  VisitorSummary,
} from "@/types/analytics"

// 일별 상세 데이터 조회
export async function getDailyVisitorData(days: number = 30): Promise<DailyVisitorData[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(days - 1)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "sessions" },
      { name: "newUsers" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
  })

  return (response.rows || []).map((row) => {
    const dateStr = row.dimensionValues?.[0]?.value || ""
    // YYYYMMDD -> YYYY-MM-DD 형식으로 변환
    const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    return {
      date: formatted,
      visitors: parseInt(row.metricValues?.[0]?.value || "0"),
      pageviews: parseInt(row.metricValues?.[1]?.value || "0"),
      sessions: parseInt(row.metricValues?.[2]?.value || "0"),
      newUsers: parseInt(row.metricValues?.[3]?.value || "0"),
      bounceRate: parseFloat(row.metricValues?.[4]?.value || "0") * 100,
      avgDuration: parseFloat(row.metricValues?.[5]?.value || "0"),
    }
  })
}

// 주 시작일 계산 (월요일 기준)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 월요일을 주 시작으로
  d.setDate(diff)
  return d
}

// 주 번호 계산 (ISO 8601)
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `W${weekNum.toString().padStart(2, "0")}`
}

// 일별 데이터를 주별로 집계
function aggregateToWeekly(daily: DailyVisitorData[]): WeeklyVisitorData[] {
  const weeklyMap = new Map<string, {
    week_start: Date
    week_end: Date
    days: DailyVisitorData[]
  }>()

  // 일별 데이터를 주별로 그룹화
  for (const day of daily) {
    const date = new Date(day.date)
    const weekStart = getWeekStart(date)
    const weekKey = formatDate(weekStart)

    if (!weeklyMap.has(weekKey)) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weeklyMap.set(weekKey, {
        week_start: weekStart,
        week_end: weekEnd,
        days: [],
      })
    }
    weeklyMap.get(weekKey)!.days.push(day)
  }

  // 주별 집계
  const weeks: WeeklyVisitorData[] = Array.from(weeklyMap.entries())
    .map(([, data]) => {
      const { week_start, week_end, days } = data
      const weekLabel = getWeekNumber(week_start)

      return {
        week_label: weekLabel,
        week_start: formatDate(week_start),
        week_end: formatDate(week_end),
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0
          ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length
          : 0,
        avgDuration: days.length > 0
          ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length
          : 0,
      }
    })
    .sort((a, b) => b.week_start.localeCompare(a.week_start)) // 최신 주가 먼저

  // 전주 대비 변화율 계산
  for (let i = 0; i < weeks.length - 1; i++) {
    const current = weeks[i]
    const previous = weeks[i + 1]

    current.visitors_change = calculateChange(current.visitors, previous.visitors)
    current.pageviews_change = calculateChange(current.pageviews, previous.pageviews)
    current.sessions_change = calculateChange(current.sessions, previous.sessions)
    current.bounceRate_change = calculateChange(current.bounceRate, previous.bounceRate)
  }

  return weeks
}

// 변화율 계산 헬퍼
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

// 일별 데이터를 월별로 집계
function aggregateToMonthly(daily: DailyVisitorData[], weekly: WeeklyVisitorData[]): MonthlyVisitorData[] {
  const monthlyMap = new Map<string, DailyVisitorData[]>()

  // 일별 데이터를 월별로 그룹화
  for (const day of daily) {
    const month = day.date.substring(0, 7) // "2025-12"
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, [])
    }
    monthlyMap.get(month)!.push(day)
  }

  // 월별 집계
  const months: MonthlyVisitorData[] = Array.from(monthlyMap.entries())
    .map(([month, days]) => {
      const [year, m] = month.split("-")
      const monthLabel = `${year}년 ${parseInt(m)}월`

      // 해당 월에 속하는 주 데이터 필터링
      const monthWeeks = weekly.filter((w) => {
        return w.week_start.startsWith(month) || w.week_end.startsWith(month)
      })

      return {
        month,
        month_label: monthLabel,
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0
          ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length
          : 0,
        avgDuration: days.length > 0
          ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length
          : 0,
        weeks: monthWeeks,
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month)) // 최신 월이 먼저

  // 전월 대비 변화율 계산
  for (let i = 0; i < months.length - 1; i++) {
    const current = months[i]
    const previous = months[i + 1]

    current.visitors_change = calculateChange(current.visitors, previous.visitors)
    current.pageviews_change = calculateChange(current.pageviews, previous.pageviews)
    current.sessions_change = calculateChange(current.sessions, previous.sessions)
    current.bounceRate_change = calculateChange(current.bounceRate, previous.bounceRate)
  }

  return months
}

// 누적 데이터 조회 (일/주/월 모두 포함)
export async function getAggregatedVisitorData(days: number = 90): Promise<AggregatedVisitorData> {
  const daily = await getDailyVisitorData(days)
  const weekly = aggregateToWeekly(daily)
  const monthly = aggregateToMonthly(daily, weekly)

  // 요약 데이터 계산
  const summary: VisitorSummary = {
    total_visitors: daily.reduce((sum, d) => sum + d.visitors, 0),
    total_pageviews: daily.reduce((sum, d) => sum + d.pageviews, 0),
    total_sessions: daily.reduce((sum, d) => sum + d.sessions, 0),
    avg_bounce_rate: daily.length > 0
      ? daily.reduce((sum, d) => sum + d.bounceRate, 0) / daily.length
      : 0,
    avg_session_duration: daily.length > 0
      ? daily.reduce((sum, d) => sum + d.avgDuration, 0) / daily.length
      : 0,
    date_range: {
      start: daily.length > 0 ? daily[daily.length - 1].date : "",
      end: daily.length > 0 ? daily[0].date : "",
    },
  }

  return { daily, weekly, monthly, summary }
}

// =====================
// 트래픽 유입 분석
// =====================

import type {
  TrafficChannel,
  TrafficSourcesData,
} from "@/types/analytics"

// 채널별 트래픽 분석
export async function getTrafficChannelData(): Promise<TrafficChannel[]> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(29)
  const endDate = formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  })

  const channelMapping: Record<string, string> = {
    "Direct": "direct",
    "Organic Search": "organic",
    "Referral": "referral",
    "Organic Social": "social",
    "Paid Search": "paid",
    "Email": "email",
    "Display": "display",
    "Paid Social": "paid_social",
  }

  const totalVisitors = (response.rows || []).reduce(
    (sum, row) => sum + parseInt(row.metricValues?.[0]?.value || "0"),
    0
  )

  return (response.rows || []).map((row) => {
    const channelName = row.dimensionValues?.[0]?.value || "Other"
    const visitors = parseInt(row.metricValues?.[0]?.value || "0")
    return {
      channel: channelMapping[channelName] || channelName.toLowerCase(),
      visitors,
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
      percentage: totalVisitors > 0 ? (visitors / totalVisitors) * 100 : 0,
      bounceRate: parseFloat(row.metricValues?.[2]?.value || "0") * 100,
      avgDuration: parseFloat(row.metricValues?.[3]?.value || "0"),
    }
  })
}

// 유입 출처별 상세 분석
export async function getTrafficSourcesDetailData(): Promise<TrafficSourcesData> {
  const client = getAnalyticsClient()
  const startDate = getDaysAgo(29)
  const endDate = formatDate(new Date())

  // 채널 데이터
  const channels = await getTrafficChannelData()

  // 출처/매체별 데이터
  const [sourcesResponse] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionSource" },
      { name: "sessionMedium" },
    ],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 15,
  })

  const sources = (sourcesResponse.rows || []).map((row) => ({
    source: row.dimensionValues?.[0]?.value || "(direct)",
    medium: row.dimensionValues?.[1]?.value || "(none)",
    visitors: parseInt(row.metricValues?.[0]?.value || "0"),
    sessions: parseInt(row.metricValues?.[1]?.value || "0"),
    bounceRate: parseFloat(row.metricValues?.[2]?.value || "0") * 100,
    avgDuration: parseFloat(row.metricValues?.[3]?.value || "0"),
  }))

  // Top Referrer 데이터
  const [referrerResponse] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "pageReferrer" },
      { name: "landingPage" },
    ],
    metrics: [{ name: "activeUsers" }],
    dimensionFilter: {
      filter: {
        fieldName: "pageReferrer",
        stringFilter: {
          matchType: "CONTAINS",
          value: ".",
          caseSensitive: false,
        },
      },
    },
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 10,
  })

  const topReferrers = (referrerResponse.rows || []).map((row) => ({
    referrer: row.dimensionValues?.[0]?.value || "",
    landingPage: row.dimensionValues?.[1]?.value || "/",
    visitors: parseInt(row.metricValues?.[0]?.value || "0"),
  }))

  return { channels, sources, topReferrers }
}

// =====================
// UTM 캠페인 분석
// =====================

import type {
  CampaignData,
  CampaignAnalyticsData,
  ConversionGoal,
  ConversionByChannel,
  ConversionAnalyticsData,
  FunnelStep,
} from "@/types/analytics"

// 전환 목표 정의 (GA4 이벤트 매핑)
const CONVERSION_GOALS: { event: string; label: string; value: number }[] = [
  { event: "form_submit_contact", label: "문의 폼 제출", value: 50000 },
  { event: "click_phone", label: "전화 클릭", value: 30000 },
  { event: "click_kakao", label: "카카오톡 상담", value: 20000 },
  { event: "view_portfolio", label: "포트폴리오 조회", value: 5000 },
  { event: "newsletter_signup", label: "뉴스레터 구독", value: 10000 },
]

// UTM 캠페인 성과 조회
export async function getCampaignPerformanceData(
  startDate?: string,
  endDate?: string,
  campaignFilter?: string
): Promise<CampaignAnalyticsData> {
  const client = getAnalyticsClient()
  const start = startDate || getDaysAgo(29)
  const end = endDate || formatDate(new Date())

  // 캠페인별 데이터 조회
  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [
      { name: "sessionCampaignName" },
      { name: "sessionSource" },
      { name: "sessionMedium" },
      { name: "firstUserCampaignName" },
    ],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
      { name: "conversions" },
    ],
    dimensionFilter: campaignFilter
      ? {
          filter: {
            fieldName: "sessionCampaignName",
            stringFilter: {
              matchType: "CONTAINS",
              value: campaignFilter,
              caseSensitive: false,
            },
          },
        }
      : undefined,
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 50,
  })

  const campaigns: CampaignData[] = (response.rows || [])
    .filter((row) => {
      const campaign = row.dimensionValues?.[0]?.value || "(not set)"
      return campaign !== "(not set)" && campaign !== "(direct)"
    })
    .map((row) => {
      const visitors = parseInt(row.metricValues?.[0]?.value || "0")
      const sessions = parseInt(row.metricValues?.[1]?.value || "0")
      const conversions = parseInt(row.metricValues?.[4]?.value || "0")

      return {
        campaign: row.dimensionValues?.[0]?.value || "(not set)",
        source: row.dimensionValues?.[1]?.value || "(direct)",
        medium: row.dimensionValues?.[2]?.value || "(none)",
        visitors,
        sessions,
        conversions,
        cvr: sessions > 0 ? (conversions / sessions) * 100 : 0,
        bounceRate: parseFloat(row.metricValues?.[2]?.value || "0") * 100,
        avgDuration: parseFloat(row.metricValues?.[3]?.value || "0"),
      }
    })

  // 요약 데이터 계산
  const totalVisitors = campaigns.reduce((sum, c) => sum + c.visitors, 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)
  const totalSessions = campaigns.reduce((sum, c) => sum + c.sessions, 0)

  return {
    campaigns,
    summary: {
      total_campaigns: campaigns.length,
      total_visitors: totalVisitors,
      total_conversions: totalConversions,
      avg_cvr: totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0,
    },
  }
}

// 전환 목표별 성과 조회
export async function getConversionGoalsData(
  startDate?: string,
  endDate?: string
): Promise<ConversionGoal[]> {
  const client = getAnalyticsClient()
  const start = startDate || getDaysAgo(29)
  const end = endDate || formatDate(new Date())

  // 전체 세션 수 조회 (CVR 계산용)
  const [sessionsResponse] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    metrics: [{ name: "sessions" }],
  })

  const totalSessions = parseInt(
    sessionsResponse.rows?.[0]?.metricValues?.[0]?.value || "0"
  )

  // 이벤트별 전환 수 조회
  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      orGroup: {
        expressions: CONVERSION_GOALS.map((goal) => ({
          filter: {
            fieldName: "eventName",
            stringFilter: {
              matchType: "EXACT",
              value: goal.event,
              caseSensitive: true,
            },
          },
        })),
      },
    },
  })

  // 결과 매핑
  const eventCounts = new Map<string, number>()
  for (const row of response.rows || []) {
    const eventName = row.dimensionValues?.[0]?.value || ""
    const count = parseInt(row.metricValues?.[0]?.value || "0")
    eventCounts.set(eventName, count)
  }

  return CONVERSION_GOALS.map((goal) => {
    const conversions = eventCounts.get(goal.event) || 0
    return {
      goal_name: goal.event,
      goal_label: goal.label,
      conversions,
      conversion_value: conversions * goal.value,
      cvr: totalSessions > 0 ? (conversions / totalSessions) * 100 : 0,
    }
  }).sort((a, b) => b.conversions - a.conversions)
}

// 채널별 전환 성과 조회
export async function getConversionByChannelData(
  startDate?: string,
  endDate?: string
): Promise<ConversionByChannel[]> {
  const client = getAnalyticsClient()
  const start = startDate || getDaysAgo(29)
  const end = endDate || formatDate(new Date())

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "sessions" },
      { name: "conversions" },
    ],
    orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
  })

  const channelMapping: Record<string, string> = {
    "Direct": "direct",
    "Organic Search": "organic",
    "Referral": "referral",
    "Organic Social": "social",
    "Paid Search": "paid",
    "Email": "email",
    "Display": "display",
    "Paid Social": "paid_social",
  }

  return (response.rows || []).map((row) => {
    const channelName = row.dimensionValues?.[0]?.value || "Other"
    const sessions = parseInt(row.metricValues?.[0]?.value || "0")
    const conversions = parseInt(row.metricValues?.[1]?.value || "0")
    // 평균 전환 가치 계산 (간단히 50,000원 기준)
    const avgValue = 50000

    return {
      channel: channelMapping[channelName] || channelName.toLowerCase(),
      conversions,
      cvr: sessions > 0 ? (conversions / sessions) * 100 : 0,
      value: conversions * avgValue,
    }
  })
}

// 마케팅 퍼널 데이터 조회
export async function getFunnelData(
  startDate?: string,
  endDate?: string
): Promise<{
  steps: FunnelStep[]
  funnel: { acquisition: number; engagement: number; interest: number; conversion: number }
}> {
  const client = getAnalyticsClient()
  const start = startDate || getDaysAgo(29)
  const end = endDate || formatDate(new Date())

  // 기본 메트릭 조회
  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    metrics: [
      { name: "sessions" }, // 유입
      { name: "engagedSessions" }, // 참여
      { name: "conversions" }, // 전환
    ],
  })

  const sessions = parseInt(response.rows?.[0]?.metricValues?.[0]?.value || "0")
  const engagedSessions = parseInt(response.rows?.[0]?.metricValues?.[1]?.value || "0")
  const conversions = parseInt(response.rows?.[0]?.metricValues?.[2]?.value || "0")

  // 관심 단계: 참여 세션의 55% (핵심 페이지 도달 추정)
  const interest = Math.round(engagedSessions * 0.55)

  const funnel = {
    acquisition: sessions,
    engagement: engagedSessions,
    interest,
    conversion: conversions,
  }

  const steps: FunnelStep[] = [
    {
      step: 1,
      name: "유입",
      users: sessions,
      rate: 100,
    },
    {
      step: 2,
      name: "참여",
      users: engagedSessions,
      rate: sessions > 0 ? (engagedSessions / sessions) * 100 : 0,
      dropoff: sessions > 0 ? ((sessions - engagedSessions) / sessions) * 100 : 0,
    },
    {
      step: 3,
      name: "관심",
      users: interest,
      rate: sessions > 0 ? (interest / sessions) * 100 : 0,
      dropoff: engagedSessions > 0 ? ((engagedSessions - interest) / engagedSessions) * 100 : 0,
    },
    {
      step: 4,
      name: "전환",
      users: conversions,
      rate: sessions > 0 ? (conversions / sessions) * 100 : 0,
      dropoff: interest > 0 ? ((interest - conversions) / interest) * 100 : 0,
    },
  ]

  return { steps, funnel }
}

// 전체 전환 분석 데이터
export async function getConversionAnalyticsData(
  startDate?: string,
  endDate?: string
): Promise<ConversionAnalyticsData> {
  const [goals, byChannel, funnelData] = await Promise.all([
    getConversionGoalsData(startDate, endDate),
    getConversionByChannelData(startDate, endDate),
    getFunnelData(startDate, endDate),
  ])

  return {
    goals,
    by_channel: byChannel,
    funnel: funnelData.funnel,
  }
}

// =====================
// 캐시 설정 (5분)
// =====================

interface DashboardResult {
  overview: AnalyticsOverview & {
    changes: {
      users: number
      pageViews: number
      bounceRate: number
      avgSessionDuration: number
    }
  }
  daily: DailyMetrics[]
  sources: TrafficSource[]
  pages: TopPage[]
  devices: DeviceCategory[]
}

let cachedData: DashboardResult | null = null
let cacheTime: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5분

// 전체 대시보드 데이터
export async function getDashboardData() {
  // 캐시가 유효한 경우 캐시된 데이터 반환
  const now = Date.now()
  if (cachedData && (now - cacheTime) < CACHE_DURATION) {
    return cachedData
  }

  try {
    const [today, yesterday, daily, sources, pages, devices] = await Promise.all([
      getTodayOverview(),
      getYesterdayOverview(),
      getDailyMetrics(7),
      getTrafficSources(),
      getTopPages(),
      getDeviceCategories(),
    ])

    // 변화율 계산
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return 0
      return ((current - previous) / previous) * 100
    }

    const result = {
      overview: {
        ...today,
        changes: {
          users: calculateChange(today.totalUsers, yesterday.totalUsers),
          pageViews: calculateChange(today.pageViews, yesterday.pageViews),
          bounceRate: calculateChange(today.bounceRate, yesterday.bounceRate),
          avgSessionDuration: calculateChange(today.avgSessionDuration, yesterday.avgSessionDuration),
        },
      },
      daily,
      sources,
      pages,
      devices,
    }

    // 캐시 저장
    cachedData = result
    cacheTime = now

    return result
  } catch (error) {
    console.error("Failed to fetch GA4 data:", error)
    throw error
  }
}

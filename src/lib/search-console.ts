import { google } from "googleapis"

const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || "https://polarad.co.kr"

// 서비스 계정 인증 설정
function getSearchConsoleClient() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google credentials not configured")
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  })

  return google.searchconsole({ version: "v1", auth })
}

export interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleData {
  queries: SearchQuery[]
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

// 날짜 포맷 함수
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

// n일 전 날짜
function getDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDate(date)
}

// 검색 쿼리 데이터 조회
export async function getSearchQueries(days: number = 7): Promise<SearchConsoleData> {
  const searchconsole = getSearchConsoleClient()
  const startDate = getDaysAgo(days)
  const endDate = getDaysAgo(1) // 어제까지 (오늘 데이터는 불완전)

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 10,
      dataState: "final",
    },
  })

  const rows = response.data.rows || []

  const queries: SearchQuery[] = rows.map((row) => ({
    query: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  }))

  // 총계 계산
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgPosition =
    queries.length > 0
      ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length
      : 0

  return {
    queries,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  }
}

// 페이지별 성과 데이터
export async function getPagePerformance(days: number = 7) {
  const searchconsole = getSearchConsoleClient()
  const startDate = getDaysAgo(days)
  const endDate = getDaysAgo(1)

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 10,
      dataState: "final",
    },
  })

  const rows = response.data.rows || []

  return rows.map((row) => ({
    page: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  }))
}

// 기간 지정 검색어 조회 (시작일, 종료일 직접 지정)
export async function getSearchQueriesByDateRange(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<SearchConsoleData> {
  const searchconsole = getSearchConsoleClient()

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: limit,
      dataState: "final",
    },
  })

  const rows = response.data.rows || []

  const queries: SearchQuery[] = rows.map((row) => ({
    query: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  }))

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgPosition =
    queries.length > 0
      ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length
      : 0

  return {
    queries,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  }
}

// 누적 검색어 데이터 조회 (최대 16개월)
export async function getCumulativeSearchQueries(limit: number = 10): Promise<SearchConsoleData> {
  const searchconsole = getSearchConsoleClient()

  // Search Console API는 최대 16개월 데이터 제공
  const endDate = getDaysAgo(1)
  const startDate = getDaysAgo(480) // 약 16개월

  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: limit,
      dataState: "final",
    },
  })

  const rows = response.data.rows || []

  const queries: SearchQuery[] = rows.map((row) => ({
    query: row.keys?.[0] || "",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: (row.ctr || 0) * 100,
    position: row.position || 0,
  }))

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgPosition =
    queries.length > 0
      ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length
      : 0

  return {
    queries,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  }
}

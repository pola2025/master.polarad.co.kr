import Airtable from "airtable"
import type { DailyVisitorData } from "@/types/analytics"

// Airtable 설정
const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appZGz8IyauViqyCl"

// 테이블 ID
const TABLES = {
  DAILY_ANALYTICS: "daily_analytics",
  TRAFFIC_SOURCES: "traffic_sources",
  CACHE_METADATA: "cache_metadata",
}

// Airtable Base 인스턴스
function getBase() {
  if (!AIRTABLE_API_TOKEN) {
    throw new Error("AIRTABLE_API_TOKEN is not configured")
  }

  Airtable.configure({
    apiKey: AIRTABLE_API_TOKEN,
  })

  return Airtable.base(AIRTABLE_BASE_ID)
}

// 날짜 포맷
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

// =====================
// 캐시 메타데이터 관리
// =====================

interface CacheMetadata {
  cache_key: string
  last_updated: string
  status: "success" | "error" | "pending"
  record_count: number
  error_message?: string
}

// 캐시 메타데이터 조회
export async function getCacheMetadata(cacheKey: string): Promise<CacheMetadata | null> {
  try {
    const base = getBase()
    const records = await base(TABLES.CACHE_METADATA)
      .select({
        filterByFormula: `{cache_key} = '${cacheKey}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) return null

    const record = records[0]
    return {
      cache_key: record.get("cache_key") as string,
      last_updated: record.get("last_updated") as string,
      status: record.get("status") as "success" | "error" | "pending",
      record_count: record.get("record_count") as number,
      error_message: record.get("error_message") as string | undefined,
    }
  } catch (error) {
    console.error("Failed to get cache metadata:", error)
    return null
  }
}

// 캐시 메타데이터 업데이트
export async function updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    const base = getBase()
    const records = await base(TABLES.CACHE_METADATA)
      .select({
        filterByFormula: `{cache_key} = '${metadata.cache_key}'`,
        maxRecords: 1,
      })
      .firstPage()

    const fields = {
      cache_key: metadata.cache_key,
      last_updated: metadata.last_updated,
      status: metadata.status,
      record_count: metadata.record_count,
      error_message: metadata.error_message || "",
    }

    if (records.length > 0) {
      // 기존 레코드 업데이트
      await base(TABLES.CACHE_METADATA).update(records[0].id, fields)
    } else {
      // 새 레코드 생성
      await base(TABLES.CACHE_METADATA).create([{ fields }])
    }
  } catch (error) {
    console.error("Failed to update cache metadata:", error)
  }
}

// =====================
// 일별 통계 캐시
// =====================

// 일별 통계 저장
export async function saveDailyAnalytics(data: DailyVisitorData[]): Promise<number> {
  const base = getBase()
  let savedCount = 0

  // 배치로 처리 (Airtable는 한 번에 10개씩)
  const batchSize = 10
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)

    // 각 날짜별로 기존 레코드 확인 후 upsert
    for (const item of batch) {
      try {
        const records = await base(TABLES.DAILY_ANALYTICS)
          .select({
            filterByFormula: `{date} = '${item.date}'`,
            maxRecords: 1,
          })
          .firstPage()

        const fields = {
          date: item.date,
          visitors: item.visitors,
          pageviews: item.pageviews,
          sessions: item.sessions,
          newUsers: item.newUsers,
          bounceRate: item.bounceRate,
          avgDuration: item.avgDuration,
          collected_at: new Date().toISOString(),
        }

        if (records.length > 0) {
          await base(TABLES.DAILY_ANALYTICS).update(records[0].id, fields)
        } else {
          await base(TABLES.DAILY_ANALYTICS).create([{ fields }])
        }
        savedCount++
      } catch (error) {
        console.error(`Failed to save daily analytics for ${item.date}:`, error)
      }
    }
  }

  return savedCount
}

// 일별 통계 조회 (캐시에서)
export async function getDailyAnalyticsFromCache(days: number = 90): Promise<DailyVisitorData[]> {
  try {
    const base = getBase()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = formatDate(startDate)

    const records = await base(TABLES.DAILY_ANALYTICS)
      .select({
        filterByFormula: `IS_AFTER({date}, '${startDateStr}')`,
        sort: [{ field: "date", direction: "desc" }],
      })
      .all()

    return records.map((record) => ({
      date: record.get("date") as string,
      visitors: (record.get("visitors") as number) || 0,
      pageviews: (record.get("pageviews") as number) || 0,
      sessions: (record.get("sessions") as number) || 0,
      newUsers: (record.get("newUsers") as number) || 0,
      bounceRate: (record.get("bounceRate") as number) || 0,
      avgDuration: (record.get("avgDuration") as number) || 0,
    }))
  } catch (error) {
    console.error("Failed to get daily analytics from cache:", error)
    return []
  }
}

// =====================
// 트래픽 소스 캐시
// =====================

interface TrafficSourceCache {
  date: string
  channel: string
  visitors: number
  sessions: number
  percentage: number
  bounceRate: number
  avgDuration: number
}

// 트래픽 소스 저장
export async function saveTrafficSources(data: TrafficSourceCache[]): Promise<number> {
  const base = getBase()
  let savedCount = 0

  // 오늘 날짜의 기존 데이터 삭제 후 새로 저장
  const today = formatDate(new Date())

  try {
    // 기존 오늘 데이터 찾기
    const existingRecords = await base(TABLES.TRAFFIC_SOURCES)
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all()

    // 기존 레코드 삭제
    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id)
      // 배치로 삭제 (10개씩)
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10)
        await base(TABLES.TRAFFIC_SOURCES).destroy(batch)
      }
    }

    // 새 데이터 저장
    const batchSize = 10
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      const records = batch.map((item) => ({
        fields: {
          date: item.date,
          channel: item.channel,
          visitors: item.visitors,
          sessions: item.sessions,
          percentage: item.percentage,
          bounceRate: item.bounceRate,
          avgDuration: item.avgDuration,
        },
      }))

      await base(TABLES.TRAFFIC_SOURCES).create(records)
      savedCount += batch.length
    }
  } catch (error) {
    console.error("Failed to save traffic sources:", error)
  }

  return savedCount
}

// 트래픽 소스 조회 (캐시에서)
export async function getTrafficSourcesFromCache(): Promise<TrafficSourceCache[]> {
  try {
    const base = getBase()

    // 최신 날짜의 데이터 가져오기
    const records = await base(TABLES.TRAFFIC_SOURCES)
      .select({
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: 20,
      })
      .all()

    if (records.length === 0) return []

    // 가장 최신 날짜만 필터링
    const latestDate = records[0].get("date") as string
    const latestRecords = records.filter((r) => r.get("date") === latestDate)

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      channel: record.get("channel") as string,
      visitors: (record.get("visitors") as number) || 0,
      sessions: (record.get("sessions") as number) || 0,
      percentage: (record.get("percentage") as number) || 0,
      bounceRate: (record.get("bounceRate") as number) || 0,
      avgDuration: (record.get("avgDuration") as number) || 0,
    }))
  } catch (error) {
    console.error("Failed to get traffic sources from cache:", error)
    return []
  }
}

// =====================
// 캐시 유효성 검사
// =====================

// 캐시가 유효한지 확인 (기본 24시간)
export async function isCacheValid(cacheKey: string, maxAgeHours: number = 24): Promise<boolean> {
  const metadata = await getCacheMetadata(cacheKey)

  if (!metadata || metadata.status !== "success") {
    return false
  }

  const lastUpdated = new Date(metadata.last_updated)
  const now = new Date()
  const ageHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)

  return ageHours < maxAgeHours
}

// 캐시 키 상수
export const CACHE_KEYS = {
  DAILY_ANALYTICS: "daily_analytics",
  TRAFFIC_SOURCES: "traffic_sources",
} as const

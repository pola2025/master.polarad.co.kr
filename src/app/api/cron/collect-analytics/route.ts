import { NextRequest, NextResponse } from "next/server"
import { getDailyVisitorData, getTrafficChannelData } from "@/lib/google-analytics"
import {
  saveDailyAnalytics,
  saveTrafficSources,
  updateCacheMetadata,
  CACHE_KEYS,
} from "@/lib/airtable-cache"

// Vercel Cron Secret 검증 (선택적)
const CRON_SECRET = process.env.CRON_SECRET

// 최대 실행 시간 설정 (Vercel Pro: 60초, Hobby: 10초)
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Cron Secret 검증 (설정된 경우)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    success: true,
    collections: {},
  }

  try {
    // 1. 일별 통계 수집 (최근 7일)
    console.log("[Cron] Collecting daily analytics...")
    try {
      const dailyData = await getDailyVisitorData(7)
      const savedCount = await saveDailyAnalytics(dailyData)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.DAILY_ANALYTICS,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        daily_analytics: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Daily analytics: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Daily analytics error:", error)
      await updateCacheMetadata({
        cache_key: CACHE_KEYS.DAILY_ANALYTICS,
        last_updated: new Date().toISOString(),
        status: "error",
        record_count: 0,
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      results.collections = {
        ...results.collections as object,
        daily_analytics: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // 2. 트래픽 소스 수집
    console.log("[Cron] Collecting traffic sources...")
    try {
      const trafficData = await getTrafficChannelData()
      const today = new Date().toISOString().split("T")[0]

      const trafficWithDate = trafficData.map((item) => ({
        date: today,
        ...item,
      }))

      const savedCount = await saveTrafficSources(trafficWithDate)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.TRAFFIC_SOURCES,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        traffic_sources: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Traffic sources: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Traffic sources error:", error)
      await updateCacheMetadata({
        cache_key: CACHE_KEYS.TRAFFIC_SOURCES,
        last_updated: new Date().toISOString(),
        status: "error",
        record_count: 0,
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      results.collections = {
        ...results.collections as object,
        traffic_sources: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[Cron] Critical error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// POST도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request)
}

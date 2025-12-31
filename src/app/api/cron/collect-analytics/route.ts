import { NextRequest, NextResponse } from "next/server"
import {
  getDailyVisitorData,
  getTrafficChannelData,
  getTopPagesDetailed,
  getDeviceCategoriesWithPercent,
  getCountryData,
  getHourlyTrafficData,
} from "@/lib/google-analytics"
import {
  saveDailyAnalytics,
  saveTrafficSources,
  saveTopPages,
  saveDeviceStats,
  saveCountryStats,
  saveHourlyTraffic,
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

    // 3. 페이지별 통계 수집
    console.log("[Cron] Collecting top pages...")
    try {
      const pagesData = await getTopPagesDetailed(7)
      const today = new Date().toISOString().split("T")[0]

      const pagesWithDate = pagesData.map((item) => ({
        date: today,
        ...item,
      }))

      const savedCount = await saveTopPages(pagesWithDate)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.TOP_PAGES,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        top_pages: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Top pages: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Top pages error:", error)
      results.collections = {
        ...results.collections as object,
        top_pages: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // 4. 기기별 통계 수집
    console.log("[Cron] Collecting device stats...")
    try {
      const devicesData = await getDeviceCategoriesWithPercent(7)
      const today = new Date().toISOString().split("T")[0]

      const devicesWithDate = devicesData.map((item) => ({
        date: today,
        ...item,
      }))

      const savedCount = await saveDeviceStats(devicesWithDate)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.DEVICES,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        devices: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Device stats: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Device stats error:", error)
      results.collections = {
        ...results.collections as object,
        devices: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // 5. 지역별 통계 수집
    console.log("[Cron] Collecting country stats...")
    try {
      const countriesData = await getCountryData(7)
      const today = new Date().toISOString().split("T")[0]

      const countriesWithDate = countriesData.map((item) => ({
        date: today,
        ...item,
      }))

      const savedCount = await saveCountryStats(countriesWithDate)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.COUNTRIES,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        countries: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Country stats: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Country stats error:", error)
      results.collections = {
        ...results.collections as object,
        countries: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // 6. 시간대별 통계 수집
    console.log("[Cron] Collecting hourly traffic...")
    try {
      const hourlyData = await getHourlyTrafficData(7)
      const today = new Date().toISOString().split("T")[0]

      const hourlyWithDate = hourlyData.map((item) => ({
        date: today,
        ...item,
      }))

      const savedCount = await saveHourlyTraffic(hourlyWithDate)

      await updateCacheMetadata({
        cache_key: CACHE_KEYS.HOURLY_TRAFFIC,
        last_updated: new Date().toISOString(),
        status: "success",
        record_count: savedCount,
      })

      results.collections = {
        ...results.collections as object,
        hourly_traffic: {
          status: "success",
          count: savedCount,
        },
      }
      console.log(`[Cron] Hourly traffic: ${savedCount} records saved`)
    } catch (error) {
      console.error("[Cron] Hourly traffic error:", error)
      results.collections = {
        ...results.collections as object,
        hourly_traffic: {
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

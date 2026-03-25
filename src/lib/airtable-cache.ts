import Airtable from "airtable";
import type { DailyVisitorData } from "@/types/analytics";

// Airtable 설정
const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appZGz8IyauViqyCl";

// 테이블 ID
const TABLES = {
  DAILY_ANALYTICS: "daily_analytics",
  TRAFFIC_SOURCES: "traffic_sources",
  CACHE_METADATA: "cache_metadata",
  BOT_VISITS: "bot_visits",
  BOT_DAILY_STATS: "bot_daily_stats",
  GOOGLE_ADS_DAILY: "google_ads_daily",
};

// Airtable Base 인스턴스
function getBase() {
  if (!AIRTABLE_API_TOKEN) {
    throw new Error("AIRTABLE_API_TOKEN is not configured");
  }

  Airtable.configure({
    apiKey: AIRTABLE_API_TOKEN,
  });

  return Airtable.base(AIRTABLE_BASE_ID);
}

// 날짜 포맷
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// =====================
// 캐시 메타데이터 관리
// =====================

interface CacheMetadata {
  cache_key: string;
  last_updated: string;
  status: "success" | "error" | "pending";
  record_count: number;
  error_message?: string;
}

// 캐시 메타데이터 조회
export async function getCacheMetadata(
  cacheKey: string,
): Promise<CacheMetadata | null> {
  try {
    const base = getBase();
    const records = await base(TABLES.CACHE_METADATA)
      .select({
        filterByFormula: `{cache_key} = '${cacheKey}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
      cache_key: record.get("cache_key") as string,
      last_updated: record.get("last_updated") as string,
      status: record.get("status") as "success" | "error" | "pending",
      record_count: record.get("record_count") as number,
      error_message: record.get("error_message") as string | undefined,
    };
  } catch (error) {
    console.error("Failed to get cache metadata:", error);
    return null;
  }
}

// 캐시 메타데이터 업데이트
export async function updateCacheMetadata(
  metadata: CacheMetadata,
): Promise<void> {
  try {
    const base = getBase();
    const records = await base(TABLES.CACHE_METADATA)
      .select({
        filterByFormula: `{cache_key} = '${metadata.cache_key}'`,
        maxRecords: 1,
      })
      .firstPage();

    const fields = {
      cache_key: metadata.cache_key,
      last_updated: metadata.last_updated,
      status: metadata.status,
      record_count: metadata.record_count,
      error_message: metadata.error_message || "",
    };

    if (records.length > 0) {
      // 기존 레코드 업데이트
      await base(TABLES.CACHE_METADATA).update(records[0].id, fields);
    } else {
      // 새 레코드 생성
      await base(TABLES.CACHE_METADATA).create([{ fields }]);
    }
  } catch (error) {
    console.error("Failed to update cache metadata:", error);
  }
}

// =====================
// 일별 통계 캐시
// =====================

// 일별 통계 저장
export async function saveDailyAnalytics(
  data: DailyVisitorData[],
): Promise<number> {
  const base = getBase();
  let savedCount = 0;

  // 배치로 처리 (Airtable는 한 번에 10개씩)
  const batchSize = 10;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    // 각 날짜별로 기존 레코드 확인 후 upsert
    for (const item of batch) {
      try {
        const records = await base(TABLES.DAILY_ANALYTICS)
          .select({
            filterByFormula: `{date} = '${item.date}'`,
            maxRecords: 1,
          })
          .firstPage();

        const fields = {
          date: item.date,
          visitors: item.visitors,
          pageviews: item.pageviews,
          sessions: item.sessions,
          newUsers: item.newUsers,
          bounceRate: item.bounceRate,
          avgDuration: item.avgDuration,
          collected_at: new Date().toISOString(),
        };

        if (records.length > 0) {
          await base(TABLES.DAILY_ANALYTICS).update(records[0].id, fields);
        } else {
          await base(TABLES.DAILY_ANALYTICS).create([{ fields }]);
        }
        savedCount++;
      } catch (error) {
        console.error(
          `Failed to save daily analytics for ${item.date}:`,
          error,
        );
      }
    }
  }

  return savedCount;
}

// 일별 통계 조회 (캐시에서)
export async function getDailyAnalyticsFromCache(
  days: number = 90,
): Promise<DailyVisitorData[]> {
  try {
    const base = getBase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);

    const records = await base(TABLES.DAILY_ANALYTICS)
      .select({
        filterByFormula: `IS_AFTER({date}, '${startDateStr}')`,
        sort: [{ field: "date", direction: "desc" }],
      })
      .all();

    return records.map((record) => ({
      date: record.get("date") as string,
      visitors: (record.get("visitors") as number) || 0,
      pageviews: (record.get("pageviews") as number) || 0,
      sessions: (record.get("sessions") as number) || 0,
      newUsers: (record.get("newUsers") as number) || 0,
      bounceRate: (record.get("bounceRate") as number) || 0,
      avgDuration: (record.get("avgDuration") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get daily analytics from cache:", error);
    return [];
  }
}

// =====================
// 트래픽 소스 캐시
// =====================

interface TrafficSourceCache {
  date: string;
  channel: string;
  visitors: number;
  sessions: number;
  percentage: number;
  bounceRate: number;
  avgDuration: number;
}

// 트래픽 소스 저장
export async function saveTrafficSources(
  data: TrafficSourceCache[],
): Promise<number> {
  const base = getBase();
  let savedCount = 0;

  // 오늘 날짜의 기존 데이터 삭제 후 새로 저장
  const today = formatDate(new Date());

  try {
    // 기존 오늘 데이터 찾기
    const existingRecords = await base(TABLES.TRAFFIC_SOURCES)
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all();

    // 기존 레코드 삭제
    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id);
      // 배치로 삭제 (10개씩)
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await base(TABLES.TRAFFIC_SOURCES).destroy(batch);
      }
    }

    // 새 데이터 저장
    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
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
      }));

      await base(TABLES.TRAFFIC_SOURCES).create(records);
      savedCount += batch.length;
    }
  } catch (error) {
    console.error("Failed to save traffic sources:", error);
  }

  return savedCount;
}

// 트래픽 소스 조회 (캐시에서)
export async function getTrafficSourcesFromCache(): Promise<
  TrafficSourceCache[]
> {
  try {
    const base = getBase();

    // 최신 날짜의 데이터 가져오기
    const records = await base(TABLES.TRAFFIC_SOURCES)
      .select({
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: 20,
      })
      .all();

    if (records.length === 0) return [];

    // 가장 최신 날짜만 필터링
    const latestDate = records[0].get("date") as string;
    const latestRecords = records.filter((r) => r.get("date") === latestDate);

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      channel: record.get("channel") as string,
      visitors: (record.get("visitors") as number) || 0,
      sessions: (record.get("sessions") as number) || 0,
      percentage: (record.get("percentage") as number) || 0,
      bounceRate: (record.get("bounceRate") as number) || 0,
      avgDuration: (record.get("avgDuration") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get traffic sources from cache:", error);
    return [];
  }
}

// =====================
// 캐시 유효성 검사
// =====================

// 캐시가 유효한지 확인 (기본 24시간)
export async function isCacheValid(
  cacheKey: string,
  maxAgeHours: number = 24,
): Promise<boolean> {
  const metadata = await getCacheMetadata(cacheKey);

  if (!metadata || metadata.status !== "success") {
    return false;
  }

  const lastUpdated = new Date(metadata.last_updated);
  const now = new Date();
  const ageHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

  return ageHours < maxAgeHours;
}

// 캐시 키 상수
export const CACHE_KEYS = {
  DAILY_ANALYTICS: "daily_analytics",
  TRAFFIC_SOURCES: "traffic_sources",
  TOP_PAGES: "top_pages",
  DEVICES: "devices",
  COUNTRIES: "countries",
  HOURLY_TRAFFIC: "hourly_traffic",
  GOOGLE_ADS_DAILY: "google_ads_daily",
} as const;

// =====================
// 페이지별 통계 캐시
// =====================

interface TopPageCache {
  date: string;
  path: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTime: string;
  bounceRate: number;
}

// 페이지별 통계 저장
export async function saveTopPages(data: TopPageCache[]): Promise<number> {
  const base = getBase();
  let savedCount = 0;
  const today = formatDate(new Date());

  try {
    // 기존 오늘 데이터 삭제
    const existingRecords = await base("top_pages")
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all();

    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id);
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await base("top_pages").destroy(batch);
      }
    }

    // 새 데이터 저장
    const batchSize = 10;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const records = batch.map((item) => ({
        fields: {
          date: item.date,
          path: item.path,
          title: item.title,
          views: item.views,
          uniqueViews: item.uniqueViews,
          avgTime: item.avgTime,
          bounceRate: item.bounceRate,
        },
      }));

      await base("top_pages").create(records);
      savedCount += batch.length;
    }
  } catch (error) {
    console.error("Failed to save top pages:", error);
  }

  return savedCount;
}

// 페이지별 통계 조회
export async function getTopPagesFromCache(): Promise<TopPageCache[]> {
  try {
    const base = getBase();
    const records = await base("top_pages")
      .select({
        sort: [
          { field: "date", direction: "desc" },
          { field: "views", direction: "desc" },
        ],
        maxRecords: 20,
      })
      .all();

    if (records.length === 0) return [];

    const latestDate = records[0].get("date") as string;
    const latestRecords = records.filter((r) => r.get("date") === latestDate);

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      path: record.get("path") as string,
      title: record.get("title") as string,
      views: (record.get("views") as number) || 0,
      uniqueViews: (record.get("uniqueViews") as number) || 0,
      avgTime: (record.get("avgTime") as string) || "0:00",
      bounceRate: (record.get("bounceRate") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get top pages from cache:", error);
    return [];
  }
}

// =====================
// 기기별 통계 캐시
// =====================

interface DeviceCache {
  date: string;
  device: string;
  visitors: number;
  percentage: number;
}

// 기기별 통계 저장
export async function saveDeviceStats(data: DeviceCache[]): Promise<number> {
  const base = getBase();
  let savedCount = 0;
  const today = formatDate(new Date());

  try {
    // 기존 오늘 데이터 삭제
    const existingRecords = await base("devices")
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all();

    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id);
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await base("devices").destroy(batch);
      }
    }

    // 새 데이터 저장
    const records = data.map((item) => ({
      fields: {
        date: item.date,
        device: item.device,
        visitors: item.visitors,
        percentage: item.percentage,
      },
    }));

    await base("devices").create(records);
    savedCount = data.length;
  } catch (error) {
    console.error("Failed to save device stats:", error);
  }

  return savedCount;
}

// 기기별 통계 조회
export async function getDeviceStatsFromCache(): Promise<DeviceCache[]> {
  try {
    const base = getBase();
    const records = await base("devices")
      .select({
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: 10,
      })
      .all();

    if (records.length === 0) return [];

    const latestDate = records[0].get("date") as string;
    const latestRecords = records.filter((r) => r.get("date") === latestDate);

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      device: record.get("device") as string,
      visitors: (record.get("visitors") as number) || 0,
      percentage: (record.get("percentage") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get device stats from cache:", error);
    return [];
  }
}

// =====================
// 지역별 통계 캐시
// =====================

interface RegionCache {
  date: string;
  region: string;
  visitors: number;
  percentage: number;
}

// 지역별 통계 저장
export async function saveRegionStats(data: RegionCache[]): Promise<number> {
  const base = getBase();
  let savedCount = 0;
  const today = formatDate(new Date());

  try {
    // 기존 오늘 데이터 삭제
    const existingRecords = await base("countries")
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all();

    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id);
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await base("countries").destroy(batch);
      }
    }

    // 새 데이터 저장 (Airtable 10개씩 배치)
    const records = data.map((item) => ({
      fields: {
        date: item.date,
        country: item.region,
        visitors: item.visitors,
        percentage: item.percentage,
      },
    }));

    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      await base("countries").create(batch);
    }
    savedCount = data.length;
  } catch (error) {
    console.error("Failed to save region stats:", error);
  }

  return savedCount;
}

// 지역별 통계 조회
export async function getRegionStatsFromCache(): Promise<RegionCache[]> {
  try {
    const base = getBase();
    const records = await base("countries")
      .select({
        sort: [
          { field: "date", direction: "desc" },
          { field: "visitors", direction: "desc" },
        ],
        maxRecords: 20,
      })
      .all();

    if (records.length === 0) return [];

    const latestDate = records[0].get("date") as string;
    const latestRecords = records.filter((r) => r.get("date") === latestDate);

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      region: record.get("country") as string,
      visitors: (record.get("visitors") as number) || 0,
      percentage: (record.get("percentage") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get region stats from cache:", error);
    return [];
  }
}

// =====================
// 시간대별 통계 캐시
// =====================

interface HourlyTrafficCache {
  date: string;
  hour: string;
  visitors: number;
}

// 시간대별 통계 저장
export async function saveHourlyTraffic(
  data: HourlyTrafficCache[],
): Promise<number> {
  const base = getBase();
  let savedCount = 0;
  const today = formatDate(new Date());

  try {
    // 기존 오늘 데이터 삭제
    const existingRecords = await base("hourly_traffic")
      .select({
        filterByFormula: `{date} = '${today}'`,
      })
      .all();

    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map((r) => r.id);
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        await base("hourly_traffic").destroy(batch);
      }
    }

    // 새 데이터 저장
    const records = data.map((item) => ({
      fields: {
        date: item.date,
        hour: item.hour,
        visitors: item.visitors,
      },
    }));

    await base("hourly_traffic").create(records);
    savedCount = data.length;
  } catch (error) {
    console.error("Failed to save hourly traffic:", error);
  }

  return savedCount;
}

// 시간대별 통계 조회
export async function getHourlyTrafficFromCache(): Promise<
  HourlyTrafficCache[]
> {
  try {
    const base = getBase();
    const records = await base("hourly_traffic")
      .select({
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: 12,
      })
      .all();

    if (records.length === 0) return [];

    const latestDate = records[0].get("date") as string;
    const latestRecords = records.filter((r) => r.get("date") === latestDate);

    return latestRecords.map((record) => ({
      date: record.get("date") as string,
      hour: record.get("hour") as string,
      visitors: (record.get("visitors") as number) || 0,
    }));
  } catch (error) {
    console.error("Failed to get hourly traffic from cache:", error);
    return [];
  }
}

// =====================
// 봇 방문 기록 (개별 로그)
// =====================

export interface BotVisitRecord {
  timestamp: string;
  date: string; // "2026-03-12"
  botName: string;
  category: string;
  path: string;
  ip: string;
}

// 봇 방문 1건 저장
export async function saveBotVisit(visit: BotVisitRecord): Promise<void> {
  try {
    const base = getBase();
    await base(TABLES.BOT_VISITS).create([
      {
        fields: {
          timestamp: visit.timestamp,
          date: visit.date,
          botName: visit.botName,
          category: visit.category,
          path: visit.path,
          ip: visit.ip,
        },
      },
    ]);
  } catch (error) {
    console.error("Failed to save bot visit:", error);
  }
}

// 봇 방문 배치 저장 (10개씩)
export async function saveBotVisitsBatch(
  visits: BotVisitRecord[],
): Promise<number> {
  const base = getBase();
  let savedCount = 0;

  const batchSize = 10;
  for (let i = 0; i < visits.length; i += batchSize) {
    const batch = visits.slice(i, i + batchSize);
    try {
      await base(TABLES.BOT_VISITS).create(
        batch.map((v) => ({
          fields: {
            timestamp: v.timestamp,
            date: v.date,
            botName: v.botName,
            category: v.category,
            path: v.path,
            ip: v.ip,
          },
        })),
      );
      savedCount += batch.length;
    } catch (error) {
      console.error("Failed to save bot visits batch:", error);
    }
  }

  return savedCount;
}

// 봇 방문 조회 (기간별)
export async function getBotVisitsFromCache(
  days: number = 7,
): Promise<BotVisitRecord[]> {
  try {
    const base = getBase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);

    const records = await base(TABLES.BOT_VISITS)
      .select({
        filterByFormula: `IS_AFTER({date}, '${startDateStr}')`,
        sort: [{ field: "timestamp", direction: "desc" }],
      })
      .all();

    return records.map((record) => ({
      timestamp: record.get("timestamp") as string,
      date: record.get("date") as string,
      botName: record.get("botName") as string,
      category: record.get("category") as string,
      path: record.get("path") as string,
      ip: (record.get("ip") as string) || "",
    }));
  } catch (error) {
    console.error("Failed to get bot visits from cache:", error);
    return [];
  }
}

// =====================
// 봇 일별 집계 통계
// =====================

export interface BotDailyStats {
  date: string;
  total_visits: number;
  bot_visits: number;
  human_visits: number;
  bot_percentage: number;
  categories: string; // JSON string
  top_bots: string; // JSON string
}

// 일별 봇 통계 저장 (upsert)
export async function saveBotDailyStats(stats: BotDailyStats): Promise<void> {
  try {
    const base = getBase();
    const records = await base(TABLES.BOT_DAILY_STATS)
      .select({
        filterByFormula: `{date} = '${stats.date}'`,
        maxRecords: 1,
      })
      .firstPage();

    const fields = {
      date: stats.date,
      total_visits: stats.total_visits,
      bot_visits: stats.bot_visits,
      human_visits: stats.human_visits,
      bot_percentage: stats.bot_percentage,
      categories: stats.categories,
      top_bots: stats.top_bots,
    };

    if (records.length > 0) {
      await base(TABLES.BOT_DAILY_STATS).update(records[0].id, fields);
    } else {
      await base(TABLES.BOT_DAILY_STATS).create([{ fields }]);
    }
  } catch (error) {
    console.error("Failed to save bot daily stats:", error);
  }
}

// 일별 봇 통계 조회 (기간별)
export async function getBotDailyStatsFromCache(
  days: number = 30,
): Promise<BotDailyStats[]> {
  try {
    const base = getBase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);

    const records = await base(TABLES.BOT_DAILY_STATS)
      .select({
        filterByFormula: `IS_AFTER({date}, '${startDateStr}')`,
        sort: [{ field: "date", direction: "desc" }],
      })
      .all();

    return records.map((record) => ({
      date: record.get("date") as string,
      total_visits: (record.get("total_visits") as number) || 0,
      bot_visits: (record.get("bot_visits") as number) || 0,
      human_visits: (record.get("human_visits") as number) || 0,
      bot_percentage: (record.get("bot_percentage") as number) || 0,
      categories: (record.get("categories") as string) || "{}",
      top_bots: (record.get("top_bots") as string) || "{}",
    }));
  } catch (error) {
    console.error("Failed to get bot daily stats from cache:", error);
    return [];
  }
}

// =====================
// 구글광고 일별 통계 캐시
// =====================

export interface GoogleAdsDailyCache {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  bounceRate: number;
  avgDuration: number;
  cvr: number;
  // 전체 대비 기여도
  total_visitors: number;
  total_sessions: number;
  total_conversions: number;
  visitor_contribution: number;
  session_contribution: number;
  conversion_contribution: number;
  // 광고비 (GA4↔Ads 연결 시)
  ads_cost: number | null;
  ads_clicks: number | null;
  ads_impressions: number | null;
  cpc: number | null;
  cpa: number | null;
  // 캠페인 요약 (JSON 문자열)
  campaigns_json: string;
}

// 구글광고 일별 통계 저장
export async function saveGoogleAdsDaily(
  data: GoogleAdsDailyCache,
): Promise<number> {
  const base = getBase();
  let savedCount = 0;

  try {
    // 해당 날짜에 기존 레코드 있는지 확인
    const records = await base(TABLES.GOOGLE_ADS_DAILY)
      .select({
        filterByFormula: `{date} = '${data.date}'`,
        maxRecords: 1,
      })
      .firstPage();

    const fields = {
      date: data.date,
      visitors: data.visitors,
      sessions: data.sessions,
      pageviews: data.pageviews,
      conversions: data.conversions,
      bounceRate: data.bounceRate,
      avgDuration: data.avgDuration,
      cvr: data.cvr,
      total_visitors: data.total_visitors,
      total_sessions: data.total_sessions,
      total_conversions: data.total_conversions,
      visitor_contribution: data.visitor_contribution,
      session_contribution: data.session_contribution,
      conversion_contribution: data.conversion_contribution,
      ads_cost: data.ads_cost ?? 0,
      ads_clicks: data.ads_clicks ?? 0,
      ads_impressions: data.ads_impressions ?? 0,
      cpc: data.cpc ?? 0,
      cpa: data.cpa ?? 0,
      campaigns_json: data.campaigns_json,
      collected_at: new Date().toISOString(),
    };

    if (records.length > 0) {
      await base(TABLES.GOOGLE_ADS_DAILY).update(records[0].id, fields);
    } else {
      await base(TABLES.GOOGLE_ADS_DAILY).create([{ fields }]);
    }
    savedCount = 1;
  } catch (error) {
    console.error(`Failed to save Google Ads daily for ${data.date}:`, error);
  }

  return savedCount;
}

// 구글광고 일별 통계 조회 (캐시에서)
export async function getGoogleAdsDailyFromCache(
  days: number = 90,
): Promise<GoogleAdsDailyCache[]> {
  try {
    const base = getBase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);

    const records = await base(TABLES.GOOGLE_ADS_DAILY)
      .select({
        filterByFormula: `IS_AFTER({date}, '${startDateStr}')`,
        sort: [{ field: "date", direction: "desc" }],
      })
      .all();

    return records.map((record) => ({
      date: record.get("date") as string,
      visitors: (record.get("visitors") as number) || 0,
      sessions: (record.get("sessions") as number) || 0,
      pageviews: (record.get("pageviews") as number) || 0,
      conversions: (record.get("conversions") as number) || 0,
      bounceRate: (record.get("bounceRate") as number) || 0,
      avgDuration: (record.get("avgDuration") as number) || 0,
      cvr: (record.get("cvr") as number) || 0,
      total_visitors: (record.get("total_visitors") as number) || 0,
      total_sessions: (record.get("total_sessions") as number) || 0,
      total_conversions: (record.get("total_conversions") as number) || 0,
      visitor_contribution: (record.get("visitor_contribution") as number) || 0,
      session_contribution: (record.get("session_contribution") as number) || 0,
      conversion_contribution:
        (record.get("conversion_contribution") as number) || 0,
      ads_cost: (record.get("ads_cost") as number) || null,
      ads_clicks: (record.get("ads_clicks") as number) || null,
      ads_impressions: (record.get("ads_impressions") as number) || null,
      cpc: (record.get("cpc") as number) || null,
      cpa: (record.get("cpa") as number) || null,
      campaigns_json: (record.get("campaigns_json") as string) || "[]",
    }));
  } catch (error) {
    console.error("Failed to get Google Ads daily from cache:", error);
    return [];
  }
}

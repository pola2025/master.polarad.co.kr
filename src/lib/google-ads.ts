import { GoogleAdsApi } from "google-ads-api";

const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
// MCC(관리자) 계정 ID — customer_id가 MCC인 경우 login_customer_id로 사용
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

function getClient() {
  if (
    !GOOGLE_ADS_CLIENT_ID ||
    !GOOGLE_ADS_CLIENT_SECRET ||
    !GOOGLE_ADS_DEVELOPER_TOKEN ||
    !GOOGLE_ADS_REFRESH_TOKEN ||
    !GOOGLE_ADS_CUSTOMER_ID
  ) {
    throw new Error("Google Ads API credentials not configured");
  }

  const client = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client.Customer({
    customer_id: GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
  });
}

export interface GoogleAdsCostData {
  totalCost: number; // micros → 원 변환 후
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  cpc: number | null;
  cpa: number | null;
}

export interface GoogleAdsCampaignCost {
  campaignName: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpc: number | null;
}

export interface GoogleAdsDailyCost {
  date: string; // YYYY-MM-DD
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

// 기간별 총 비용/클릭/노출/전환 조회
export async function getAdsCostSummary(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsCostData> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `);

  let totalCostMicros = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;

  for (const row of results) {
    totalCostMicros += Number(row.metrics?.cost_micros || 0);
    totalClicks += Number(row.metrics?.clicks || 0);
    totalImpressions += Number(row.metrics?.impressions || 0);
    totalConversions += Number(row.metrics?.conversions || 0);
  }

  const totalCost = totalCostMicros / 1_000_000;

  return {
    totalCost,
    totalClicks,
    totalImpressions,
    totalConversions,
    cpc: totalClicks > 0 ? totalCost / totalClicks : null,
    cpa: totalConversions > 0 ? totalCost / totalConversions : null,
  };
}

// 캠페인별 비용 조회
export async function getAdsCampaignCosts(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsCampaignCost[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
  `);

  return results
    .filter((row) => Number(row.metrics?.cost_micros || 0) > 0)
    .map((row) => {
      const cost = Number(row.metrics?.cost_micros || 0) / 1_000_000;
      const clicks = Number(row.metrics?.clicks || 0);
      const conversions = Number(row.metrics?.conversions || 0);
      return {
        campaignName: String(row.campaign?.name || "(unknown)"),
        cost,
        clicks,
        impressions: Number(row.metrics?.impressions || 0),
        conversions,
        cpc: clicks > 0 ? cost / clicks : null,
      };
    });
}

// 일별 비용 추이 조회
export async function getAdsDailyCosts(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsDailyCost[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date ASC
  `);

  return results.map((row) => ({
    date: String(row.segments?.date || ""),
    cost: Number(row.metrics?.cost_micros || 0) / 1_000_000,
    clicks: Number(row.metrics?.clicks || 0),
    impressions: Number(row.metrics?.impressions || 0),
    conversions: Number(row.metrics?.conversions || 0),
  }));
}

// 검색어 TOP N 조회
export interface GoogleAdsSearchTerm {
  searchTerm: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

export async function getAdsSearchTerms(
  startDate: string,
  endDate: string,
  limit = 50,
): Promise<GoogleAdsSearchTerm[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      search_term_view.search_term,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
    ORDER BY metrics.clicks DESC
    LIMIT ${limit}
  `);

  return results.map((row) => {
    const cost = Number(row.metrics?.cost_micros || 0) / 1_000_000;
    return {
      searchTerm: String(
        (row as Record<string, unknown>).search_term_view &&
          typeof (row as Record<string, unknown>).search_term_view === "object"
          ? (
              (row as Record<string, unknown>).search_term_view as Record<
                string,
                unknown
              >
            ).search_term || "(unknown)"
          : "(unknown)",
      ),
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      cost,
      conversions: Number(row.metrics?.conversions || 0),
      ctr: Number(row.metrics?.ctr || 0),
    };
  });
}

// 디바이스별 성과 조회
export interface GoogleAdsDevicePerformance {
  device: string; // MOBILE, DESKTOP, TABLET 등
  deviceLabel: string; // 한글
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

const DEVICE_LABELS: Record<number, string> = {
  1: "기타",
  2: "모바일",
  3: "태블릿",
  4: "PC",
  5: "커넥티드TV",
};

export async function getAdsDevicePerformance(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsDevicePerformance[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
  `);

  const deviceMap = new Map<
    number,
    {
      impressions: number;
      clicks: number;
      costMicros: number;
      conversions: number;
    }
  >();

  for (const row of results) {
    const device = Number(row.segments?.device || 1);
    const existing = deviceMap.get(device);
    if (existing) {
      existing.impressions += Number(row.metrics?.impressions || 0);
      existing.clicks += Number(row.metrics?.clicks || 0);
      existing.costMicros += Number(row.metrics?.cost_micros || 0);
      existing.conversions += Number(row.metrics?.conversions || 0);
    } else {
      deviceMap.set(device, {
        impressions: Number(row.metrics?.impressions || 0),
        clicks: Number(row.metrics?.clicks || 0),
        costMicros: Number(row.metrics?.cost_micros || 0),
        conversions: Number(row.metrics?.conversions || 0),
      });
    }
  }

  return Array.from(deviceMap.entries())
    .map(([device, data]) => ({
      device: String(device),
      deviceLabel: DEVICE_LABELS[device] || `기타(${device})`,
      impressions: data.impressions,
      clicks: data.clicks,
      cost: data.costMicros / 1_000_000,
      conversions: data.conversions,
      ctr: data.clicks > 0 ? data.clicks / data.impressions : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

// 게재위치(네트워크)별 성과 조회
export interface GoogleAdsNetworkPerformance {
  network: string;
  networkLabel: string; // 한글
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

const NETWORK_LABELS: Record<number, string> = {
  0: "지정안됨",
  1: "기타",
  2: "콘텐츠 네트워크",
  3: "디스플레이",
  4: "구글 검색",
  8: "검색 파트너",
  12: "유튜브",
};

export async function getAdsNetworkPerformance(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsNetworkPerformance[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      segments.ad_network_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
  `);

  const networkMap = new Map<
    number,
    {
      impressions: number;
      clicks: number;
      costMicros: number;
      conversions: number;
    }
  >();

  for (const row of results) {
    const network = Number(row.segments?.ad_network_type || 0);
    const existing = networkMap.get(network);
    if (existing) {
      existing.impressions += Number(row.metrics?.impressions || 0);
      existing.clicks += Number(row.metrics?.clicks || 0);
      existing.costMicros += Number(row.metrics?.cost_micros || 0);
      existing.conversions += Number(row.metrics?.conversions || 0);
    } else {
      networkMap.set(network, {
        impressions: Number(row.metrics?.impressions || 0),
        clicks: Number(row.metrics?.clicks || 0),
        costMicros: Number(row.metrics?.cost_micros || 0),
        conversions: Number(row.metrics?.conversions || 0),
      });
    }
  }

  return Array.from(networkMap.entries())
    .map(([network, data]) => ({
      network: String(network),
      networkLabel: NETWORK_LABELS[network] || `기타(${network})`,
      impressions: data.impressions,
      clicks: data.clicks,
      cost: data.costMicros / 1_000_000,
      conversions: data.conversions,
      ctr: data.clicks > 0 ? data.clicks / data.impressions : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

// 캠페인 상세 (CTR, 노출점유율 포함)
export interface GoogleAdsCampaignDetail {
  campaignName: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpc: number | null;
  searchImpressionShare: number | null;
  budgetLostImpressionShare: number | null;
  rankLostImpressionShare: number | null;
}

export async function getAdsCampaignDetails(
  startDate: string,
  endDate: string,
): Promise<GoogleAdsCampaignDetail[]> {
  const customer = getClient();

  const results = await customer.query(`
    SELECT
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
  `);

  return results.map((row) => {
    const cost = Number(row.metrics?.cost_micros || 0) / 1_000_000;
    const clicks = Number(row.metrics?.clicks || 0);
    return {
      campaignName: String(row.campaign?.name || "(unknown)"),
      cost,
      clicks,
      impressions: Number(row.metrics?.impressions || 0),
      conversions: Number(row.metrics?.conversions || 0),
      ctr: Number(row.metrics?.ctr || 0),
      cpc: clicks > 0 ? cost / clicks : null,
      searchImpressionShare:
        row.metrics?.search_impression_share != null
          ? Number(row.metrics.search_impression_share)
          : null,
      budgetLostImpressionShare:
        row.metrics?.search_budget_lost_impression_share != null
          ? Number(row.metrics.search_budget_lost_impression_share)
          : null,
      rankLostImpressionShare:
        row.metrics?.search_rank_lost_impression_share != null
          ? Number(row.metrics.search_rank_lost_impression_share)
          : null,
    };
  });
}

// Google Ads API 사용 가능 여부 확인
export function isGoogleAdsConfigured(): boolean {
  return !!(
    GOOGLE_ADS_CLIENT_ID &&
    GOOGLE_ADS_CLIENT_SECRET &&
    GOOGLE_ADS_DEVELOPER_TOKEN &&
    GOOGLE_ADS_REFRESH_TOKEN &&
    GOOGLE_ADS_CUSTOMER_ID
  );
}

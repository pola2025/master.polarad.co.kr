"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Percent,
  AlertCircle,
  Calendar,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Search,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  GoogleAdsPerformanceData,
  GoogleAdsDailyData,
} from "@/lib/google-analytics";
import type {
  GoogleAdsDevicePerformance,
  GoogleAdsNetworkPerformance,
  GoogleAdsCampaignDetail,
} from "@/lib/google-ads";

type ViewMode = "daily" | "weekly" | "monthly";

// 금액 포맷 (원)
function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만원`;
  return `${Math.round(value).toLocaleString()}원`;
}

// 초 → 분:초
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}분 ${s}초`;
}

// 날짜 포맷 "20260326" → "3/26"
function formatShortDate(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));
  return `${month}/${day}`;
}

// "20260326" → "2026-03-26"
function toIsoDate(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

// ISO week number
function getWeekKey(dateStr: string): string {
  const d = new Date(toIsoDate(dateStr));
  const onejan = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMonthKey(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

// n일 전 날짜 → "YYYY-MM-DD"
function getDaysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

interface AggregatedRow {
  label: string;
  visitors: number;
  sessions: number;
  conversions: number;
  cost: number | null;
}

function aggregateDaily(
  daily: GoogleAdsDailyData[],
  mode: ViewMode,
): AggregatedRow[] {
  if (mode === "daily") {
    return daily.map((d) => ({
      label: formatShortDate(d.date),
      visitors: d.visitors,
      sessions: d.sessions,
      conversions: d.conversions,
      cost: d.cost,
    }));
  }

  const groups = new Map<
    string,
    {
      visitors: number;
      sessions: number;
      conversions: number;
      cost: number | null;
      dates: string[];
    }
  >();

  for (const d of daily) {
    const key = mode === "weekly" ? getWeekKey(d.date) : getMonthKey(d.date);
    const existing = groups.get(key);
    if (existing) {
      existing.visitors += d.visitors;
      existing.sessions += d.sessions;
      existing.conversions += d.conversions;
      existing.dates.push(d.date);
    } else {
      groups.set(key, {
        visitors: d.visitors,
        sessions: d.sessions,
        conversions: d.conversions,
        cost: d.cost,
        dates: [d.date],
      });
    }
  }

  return Array.from(groups.entries()).map(([key, v]) => ({
    label:
      mode === "weekly"
        ? `${key} (${formatShortDate(v.dates[0])}~${formatShortDate(v.dates[v.dates.length - 1])})`
        : formatMonthLabel(key),
    ...v,
  }));
}

export default function GoogleAdsPage() {
  const [data, setData] = useState<GoogleAdsPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 날짜 필터
  const [dateRange, setDateRange] = useState("30d");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  // 뷰 모드
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  // 날짜 계산
  const getDateParams = (): { start: string; end: string } => {
    const end = todayIso();
    if (dateRange === "custom" && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    const daysMap: Record<string, number> = { "7d": 6, "30d": 29, "90d": 89 };
    const days = daysMap[dateRange] ?? 29;
    return { start: getDaysAgoIso(days), end };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { start, end } = getDateParams();
      const response = await fetch(
        `/api/analytics/google-ads?start_date=${start}&end_date=${end}`,
      );
      if (response.status === 501) {
        setError("GA4 API 인증이 설정되지 않았습니다.");
        return;
      }
      if (!response.ok) {
        setError("데이터를 불러오는데 실패했습니다.");
        return;
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch Google Ads data:", err);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, customStartDate, customEndDate]);

  const applyCustomDateRange = () => {
    if (!customStartDate || !customEndDate) return;
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    if (start > end) return;
    const startLabel = customStartDate.slice(5).replace("-", "/");
    const endLabel = customEndDate.slice(5).replace("-", "/");
    setCustomLabel(`${startLabel} ~ ${endLabel}`);
    setDateRange("custom");
    setCustomDialogOpen(false);
  };

  // 자동 뷰 모드 추천
  useEffect(() => {
    if (dateRange === "7d") setViewMode("daily");
    else if (dateRange === "30d") setViewMode("daily");
    else if (dateRange === "90d") setViewMode("weekly");
  }, [dateRange]);

  const overview = data?.overview;
  const hasCostData =
    overview?.ads_cost !== null &&
    overview?.ads_cost !== undefined &&
    overview.ads_cost > 0;

  // 집계 데이터
  const aggregated = useMemo(() => {
    if (!data?.daily) return [];
    return aggregateDaily(data.daily, viewMode);
  }, [data?.daily, viewMode]);

  // 기간 라벨
  const periodLabel =
    dateRange === "custom" && customLabel
      ? customLabel
      : dateRange === "7d"
        ? "최근 7일"
        : dateRange === "30d"
          ? "최근 30일"
          : "최근 90일";

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-blue-600" />
            구글광고 성과
          </h1>
          <p className="text-muted-foreground">
            Google Ads를 통한 유입과 전환 기여도를 분석합니다. ({periodLabel})
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            광고비/CTR/게재위치는 Google Ads API 직접 데이터, 방문자/전환은 GA4
            경유 데이터입니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 날짜 필터 */}
          <div className="flex rounded-lg border bg-background p-1">
            {["7d", "30d", "90d"].map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setDateRange(range);
                  setCustomLabel("");
                }}
                className="px-3"
              >
                {range === "7d" ? "7일" : range === "30d" ? "30일" : "90일"}
              </Button>
            ))}
          </div>
          <Button
            variant={dateRange === "custom" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCustomDialogOpen(true)}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {dateRange === "custom" && customLabel
              ? customLabel
              : "사용자 지정"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>

        {/* 사용자 지정 날짜 다이얼로그 */}
        <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>날짜 범위 선택</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ads-start-date">시작일</Label>
                <Input
                  id="ads-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate || undefined}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ads-end-date">종료일</Label>
                <Input
                  id="ads-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate || undefined}
                  max={todayIso()}
                />
              </div>
              <Button onClick={applyCustomDateRange}>적용</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* 핵심 지표 카드 (4개) */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="광고비 지출"
            value={
              hasCostData ? formatCurrency(overview.ads_cost!) : "연결 확인 중"
            }
            description={
              hasCostData
                ? `CPC ${formatCurrency(overview.cpc)}`
                : "GA4↔Ads 비용 데이터"
            }
            icon={DollarSign}
          />
          <StatCard
            title="광고 유입 방문자"
            value={overview.ads_visitors.toLocaleString()}
            description={`전체의 ${overview.visitor_contribution.toFixed(1)}%`}
            icon={Users}
            trend={
              overview.visitor_contribution > 0
                ? { value: overview.visitor_contribution, isPositive: true }
                : undefined
            }
          />
          <StatCard
            title="광고 전환"
            value={overview.ads_conversions.toLocaleString()}
            description={`전환율 ${overview.ads_cvr.toFixed(2)}%`}
            icon={MousePointerClick}
            trend={
              overview.ads_cvr >= 1
                ? { value: overview.ads_cvr, isPositive: true }
                : undefined
            }
          />
          <StatCard
            title="CTR (클릭률)"
            value={overview.ctr !== null ? `${overview.ctr.toFixed(2)}%` : "-"}
            description={
              hasCostData
                ? `${overview.ads_clicks?.toLocaleString()}클릭 / ${overview.ads_impressions?.toLocaleString()}노출`
                : "클릭 / 노출"
            }
            icon={MousePointerClick}
          />
          <StatCard
            title="노출 점유율"
            value={
              overview.searchImpressionShare !== null
                ? `${(overview.searchImpressionShare * 100).toFixed(1)}%`
                : "-"
            }
            description={
              overview.rankLostImpressionShare !== null
                ? `순위 손실 ${(overview.rankLostImpressionShare * 100).toFixed(1)}%`
                : "검색 노출 점유율"
            }
            icon={Eye}
          />
          <StatCard
            title="전환 기여도"
            value={`${overview.conversion_contribution.toFixed(1)}%`}
            description={`전체 ${overview.total_conversions}건 중 ${overview.ads_conversions}건`}
            icon={Percent}
          />
        </div>
      ) : null}

      {/* 광고 vs 전체 비교 */}
      {!loading && overview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              광고 트래픽 기여도
            </CardTitle>
            <CardDescription>
              전체 트래픽 대비 구글광고의 기여 비율
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ContributionBar
                label="방문자"
                adsValue={overview.ads_visitors}
                totalValue={overview.total_visitors}
                percentage={overview.visitor_contribution}
              />
              <ContributionBar
                label="세션"
                adsValue={overview.ads_sessions}
                totalValue={overview.total_sessions}
                percentage={overview.session_contribution}
              />
              <ContributionBar
                label="전환"
                adsValue={overview.ads_conversions}
                totalValue={overview.total_conversions}
                percentage={overview.conversion_contribution}
              />
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">이탈률</div>
                <div className="text-lg font-semibold">
                  {overview.ads_bounceRate.toFixed(1)}%
                </div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">
                  평균 체류시간
                </div>
                <div className="text-lg font-semibold">
                  {formatDuration(overview.ads_avgDuration)}
                </div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">페이지뷰</div>
                <div className="text-lg font-semibold">
                  {overview.ads_pageviews.toLocaleString()}
                </div>
              </div>
              {hasCostData && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    전환당 비용 (CPA)
                  </div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(overview.cpa)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 일별/주별/월별 추이 */}
      {!loading && aggregated.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                광고 유입 추이
              </CardTitle>
              <div className="flex rounded-lg border bg-background p-1">
                {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                    className="px-3 text-xs"
                  >
                    {mode === "daily"
                      ? "일별"
                      : mode === "weekly"
                        ? "주별"
                        : "월별"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 테이블 형태 추이 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">기간</th>
                    <th className="pb-2 font-medium text-right">방문자</th>
                    <th className="pb-2 font-medium text-right">세션</th>
                    <th className="pb-2 font-medium text-right">전환</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2 text-right">
                        {row.visitors.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {row.sessions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {row.conversions > 0 ? (
                          <span className="text-green-600 font-medium">
                            {row.conversions}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-2">합계</td>
                    <td className="py-2 text-right">
                      {aggregated
                        .reduce((s, r) => s + r.visitors, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      {aggregated
                        .reduce((s, r) => s + r.sessions, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-green-600">
                      {aggregated
                        .reduce((s, r) => s + r.conversions, 0)
                        .toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 바 차트 */}
            <div className="mt-4">
              <div className="flex items-end gap-1 h-28">
                {aggregated.map((row, i) => {
                  const maxV = Math.max(
                    ...aggregated.map((r) => r.visitors),
                    1,
                  );
                  const height = (row.visitors / maxV) * 100;
                  return (
                    <div key={i} className="flex-1 flex justify-center">
                      <div
                        className="w-full max-w-[24px] bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600 cursor-default"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${row.label}: ${row.visitors}명 방문, ${row.conversions}건 전환`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 text-[10px] text-muted-foreground mt-1">
                {aggregated.map((row, i) => {
                  const showLabel =
                    aggregated.length <= 15 ||
                    i % Math.ceil(aggregated.length / 10) === 0;
                  return (
                    <div key={i} className="flex-1 text-center truncate">
                      {showLabel ? row.label.split(" ")[0] : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 디바이스별 + 게재위치별 성과 (가로 2컬럼) */}
      {!loading &&
        data &&
        (data.devices?.length > 0 || data.networks?.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* 디바이스별 성과 */}
            {data.devices && data.devices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    디바이스별 성과
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.devices.map((device, i) => {
                      const totalCost = data.devices!.reduce(
                        (s, d) => s + d.cost,
                        0,
                      );
                      const costShare =
                        totalCost > 0 ? (device.cost / totalCost) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium flex items-center gap-1.5">
                              {device.deviceLabel === "모바일" && (
                                <Smartphone className="h-3.5 w-3.5" />
                              )}
                              {device.deviceLabel === "PC" && (
                                <Monitor className="h-3.5 w-3.5" />
                              )}
                              {device.deviceLabel === "태블릿" && (
                                <Tablet className="h-3.5 w-3.5" />
                              )}
                              {!["모바일", "PC", "태블릿"].includes(
                                device.deviceLabel,
                              ) && <Globe className="h-3.5 w-3.5" />}
                              {device.deviceLabel}
                            </span>
                            <span className="text-muted-foreground">
                              {formatCurrency(device.cost)} · {device.clicks}
                              클릭 · CTR {(device.ctr * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${Math.min(costShare, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 게재위치(네트워크)별 성과 */}
            {data.networks && data.networks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    게재위치별 성과
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">게재위치</th>
                          <th className="pb-2 font-medium text-right">노출</th>
                          <th className="pb-2 font-medium text-right">클릭</th>
                          <th className="pb-2 font-medium text-right">비용</th>
                          <th className="pb-2 font-medium text-right">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.networks.map((network, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 font-medium">
                              {network.networkLabel}
                            </td>
                            <td className="py-2 text-right">
                              {network.impressions.toLocaleString()}
                            </td>
                            <td className="py-2 text-right">
                              {network.clicks.toLocaleString()}
                            </td>
                            <td className="py-2 text-right">
                              {formatCurrency(network.cost)}
                            </td>
                            <td className="py-2 text-right">
                              {(network.ctr * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      {/* 캠페인별 성과 테이블 (상세) */}
      {!loading && data?.campaignDetails && data.campaignDetails.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>캠페인별 상세 성과</CardTitle>
            <CardDescription>CTR, 노출 점유율, 손실률 포함</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">캠페인</th>
                    <th className="pb-2 font-medium text-right">비용</th>
                    <th className="pb-2 font-medium text-right">클릭</th>
                    <th className="pb-2 font-medium text-right">노출</th>
                    <th className="pb-2 font-medium text-right">CTR</th>
                    <th className="pb-2 font-medium text-right">CPC</th>
                    <th className="pb-2 font-medium text-right">노출 점유율</th>
                    <th className="pb-2 font-medium text-right">순위 손실</th>
                    <th className="pb-2 font-medium text-right">예산 손실</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaignDetails.map((campaign, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td
                        className="py-2 font-medium max-w-[200px] truncate"
                        title={campaign.campaignName}
                      >
                        {campaign.campaignName}
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(campaign.cost)}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.clicks.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.impressions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {(campaign.ctr * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 text-right">
                        {campaign.cpc ? formatCurrency(campaign.cpc) : "-"}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.searchImpressionShare !== null ? (
                          <span
                            className={
                              campaign.searchImpressionShare < 0.3
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            {(campaign.searchImpressionShare * 100).toFixed(1)}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.rankLostImpressionShare !== null ? (
                          <span
                            className={
                              campaign.rankLostImpressionShare > 0.5
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            {(campaign.rankLostImpressionShare * 100).toFixed(
                              1,
                            )}
                            %
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.budgetLostImpressionShare !== null
                          ? `${(campaign.budgetLostImpressionShare * 100).toFixed(1)}%`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 캠페인별 성과 테이블 (GA4 기반) */}
      {!loading && data?.campaigns && data.campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>캠페인별 성과</CardTitle>
            <CardDescription>
              구글광고 캠페인별 방문자, 전환, 이탈률 비교
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">캠페인</th>
                    <th className="pb-2 font-medium text-right">방문자</th>
                    <th className="pb-2 font-medium text-right">세션</th>
                    <th className="pb-2 font-medium text-right">전환</th>
                    <th className="pb-2 font-medium text-right">전환율</th>
                    <th className="pb-2 font-medium text-right">이탈률</th>
                    <th className="pb-2 font-medium text-right">체류시간</th>
                    {hasCostData && (
                      <th className="pb-2 font-medium text-right">비용</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((campaign, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td
                        className="py-2 font-medium max-w-[200px] truncate"
                        title={campaign.campaign}
                      >
                        {campaign.campaign}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.visitors.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        {campaign.sessions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {campaign.conversions > 0 ? (
                          <span className="text-green-600">
                            {campaign.conversions}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={
                            campaign.cvr >= 2
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          {campaign.cvr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {campaign.bounceRate.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right">
                        {formatDuration(campaign.avgDuration)}
                      </td>
                      {hasCostData && (
                        <td className="py-2 text-right">
                          {formatCurrency(campaign.cost)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 데이터 없음 */}
      {!loading && !error && data?.daily?.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            선택한 기간에 구글광고(source=google, medium=cpc) 유입 데이터가
            없습니다. Google Ads에서 캠페인이 활성화되어 있는지 확인해주세요.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// 기여도 바 컴포넌트
function ContributionBar({
  label,
  adsValue,
  totalValue,
  percentage,
}: {
  label: string;
  adsValue: number;
  totalValue: number;
  percentage: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {adsValue.toLocaleString()} / {totalValue.toLocaleString()}{" "}
          <span className="font-semibold text-blue-600">
            ({percentage.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

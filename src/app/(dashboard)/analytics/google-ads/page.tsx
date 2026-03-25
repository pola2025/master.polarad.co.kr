"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Percent,
  Loader2,
  AlertCircle,
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
import type {
  GoogleAdsPerformanceData,
  GoogleAdsOverview,
  GoogleAdsDailyData,
  GoogleAdsCampaignData,
} from "@/lib/google-analytics";

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

export default function GoogleAdsPage() {
  const [data, setData] = useState<GoogleAdsPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/analytics/google-ads");
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
  }, []);

  const overview = data?.overview;
  const hasCostData =
    overview?.ads_cost !== null &&
    overview?.ads_cost !== undefined &&
    overview.ads_cost > 0;

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
            Google Ads를 통한 유입과 전환 기여도를 분석합니다. (최근 30일)
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            광고비는 GA4 경유 데이터로, Google Ads 대시보드와 최대 48시간 차이가
            있을 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

            {/* 광고 트래픽 품질 */}
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

      {/* 일별 추이 */}
      {!loading && data?.daily && data.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              일별 광고 유입 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* 간단한 바 차트 */}
              <div className="flex items-end gap-1 h-32">
                {data.daily.map((day) => {
                  const maxVisitors = Math.max(
                    ...data.daily.map((d) => d.visitors),
                    1,
                  );
                  const height = (day.visitors / maxVisitors) * 100;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-full max-w-[20px] bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600 cursor-default"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${formatShortDate(day.date)}: ${day.visitors}명 방문, ${day.conversions}건 전환`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 text-[10px] text-muted-foreground">
                {data.daily.map((day, i) => (
                  <div key={day.date} className="flex-1 text-center truncate">
                    {i % Math.ceil(data.daily.length / 10) === 0
                      ? formatShortDate(day.date)
                      : ""}
                  </div>
                ))}
              </div>
              {/* 합계 표시 */}
              <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
                <span>
                  총 방문:{" "}
                  <strong className="text-foreground">
                    {data.daily
                      .reduce((s, d) => s + d.visitors, 0)
                      .toLocaleString()}
                  </strong>
                  명
                </span>
                <span>
                  총 전환:{" "}
                  <strong className="text-foreground">
                    {data.daily
                      .reduce((s, d) => s + d.conversions, 0)
                      .toLocaleString()}
                  </strong>
                  건
                </span>
                <span>
                  일평균:{" "}
                  <strong className="text-foreground">
                    {Math.round(
                      data.daily.reduce((s, d) => s + d.visitors, 0) /
                        data.daily.length,
                    ).toLocaleString()}
                  </strong>
                  명/일
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 캠페인별 성과 테이블 */}
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
            최근 30일간 구글광고(source=google, medium=cpc) 유입 데이터가
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

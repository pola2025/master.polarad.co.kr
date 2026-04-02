"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Eye,
  Timer,
  TrendingDown,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Calendar,
  Download,
  Loader2,
  Bot,
  ShieldAlert,
  MessageSquare,
  Handshake,
  Banknote,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisitorPeriodTable } from "@/components/dashboard/visitor-period-table";
import { VisitorHeatmap } from "@/components/dashboard/visitor-heatmap";
import type { AggregatedVisitorData } from "@/types/analytics";

// 데이터 타입 정의
interface VisitorData {
  overview: {
    totalVisitors: number;
    uniqueVisitors: number;
    pageViews: number;
    avgSessionDuration: string;
    bounceRate: number;
    newVisitors: number;
    returningVisitors: number;
    changes: {
      visitors: number;
      pageViews: number;
      bounceRate: number;
      avgSessionDuration: number;
    };
  };
  daily: Array<{
    date: string;
    visitors: number;
    pageviews: number;
    sessions: number;
  }>;
  regions: Array<{ region: string; visitors: number; percentage: number }>;
  pages: Array<{
    path: string;
    title: string;
    views: number;
    uniqueViews: number;
    avgTime: string;
    bounceRate: number;
  }>;
  devices: Array<{ device: string; visitors: number; percentage: number }>;
  browsers: Array<{ browser: string; visitors: number; percentage: number }>;
  hourlyTraffic: Array<{ hour: string; visitors: number }>;
}

// 빈 데이터 (API 미설정 시)
const EMPTY_DATA: VisitorData = {
  overview: {
    totalVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    avgSessionDuration: "0분 0초",
    bounceRate: 0,
    newVisitors: 0,
    returningVisitors: 0,
    changes: {
      visitors: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    },
  },
  daily: [],
  regions: [],
  pages: [],
  devices: [],
  browsers: [],
  hourlyTraffic: [],
};

// 디바이스 아이콘 매핑
const deviceIcons: Record<string, typeof Monitor> = {
  데스크톱: Monitor,
  desktop: Monitor,
  모바일: Smartphone,
  mobile: Smartphone,
  태블릿: Tablet,
  tablet: Tablet,
};

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [visitorData, setVisitorData] = useState<VisitorData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [aggregatedData, setAggregatedData] =
    useState<AggregatedVisitorData | null>(null);
  const [aggregatedLoading, setAggregatedLoading] = useState(true);

  // 사용자 지정 날짜 필터 상태
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customDays, setCustomDays] = useState<number | null>(null);
  const [customLabel, setCustomLabel] = useState("");

  // days 계산 함수
  const getDays = () => {
    if (dateRange === "custom" && customDays) return customDays;
    if (dateRange === "24h") return 1;
    if (dateRange === "7d") return 7;
    if (dateRange === "30d") return 30;
    return 90;
  };

  // 방문 통계 데이터 조회
  useEffect(() => {
    const fetchVisitorData = async () => {
      try {
        setLoading(true);
        const days = getDays();
        const response = await fetch(`/api/analytics/visitors?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          setVisitorData(data);
        }
      } catch (error) {
        console.error("Failed to fetch visitor data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitorData();
  }, [dateRange, customDays]);

  // 누적 데이터 조회
  useEffect(() => {
    const fetchAggregatedData = async () => {
      try {
        setAggregatedLoading(true);
        const days = getDays();
        const response = await fetch(`/api/analytics/aggregated?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          setAggregatedData(data);
        }
      } catch (error) {
        console.error("Failed to fetch aggregated data:", error);
      } finally {
        setAggregatedLoading(false);
      }
    };

    fetchAggregatedData();
  }, [dateRange, customDays]);

  // 문의/계약/매출 통계
  const [inquiryStats, setInquiryStats] = useState<{
    total: number;
    contractCount: number;
    totalRevenue: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/inquiries")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stats) {
          setInquiryStats({
            total: data.stats.total,
            contractCount: data.stats.contractCount,
            totalRevenue: data.stats.totalRevenue,
          });
        }
      })
      .catch(() => {});
  }, []);

  // 봇 통계
  interface BotStats {
    total_visits: number;
    bot_visits: number;
    human_visits: number;
    bot_percentage: number;
    categories: Array<{ category: string; count: number; percentage: string }>;
    top_bots: Array<{ name: string; count: number }>;
    tracking_since: string | null;
  }
  const [botStats, setBotStats] = useState<BotStats | null>(null);

  useEffect(() => {
    const fetchBotStats = async () => {
      try {
        const days = getDays();
        const response = await fetch(`/api/analytics/bot-stats?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          setBotStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch bot stats:", error);
      }
    };
    fetchBotStats();
  }, [dateRange, customDays]);

  // 사용자 지정 날짜 적용
  const applyCustomDateRange = () => {
    if (!customStartDate || !customEndDate) return;
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    if (start > end) return;
    const diffDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const startLabel = customStartDate.slice(5).replace("-", "/");
    const endLabel = customEndDate.slice(5).replace("-", "/");
    setCustomLabel(`${startLabel} ~ ${endLabel}`);
    setCustomDays(diffDays);
    setDateRange("custom");
    setCustomDialogOpen(false);
  };

  // 신규/재방문자 비율 계산
  const totalVisitors =
    visitorData.overview.newVisitors + visitorData.overview.returningVisitors;
  const newVisitorPercent =
    totalVisitors > 0
      ? ((visitorData.overview.newVisitors / totalVisitors) * 100).toFixed(1)
      : "0";
  const returningVisitorPercent =
    totalVisitors > 0
      ? (
          (visitorData.overview.returningVisitors / totalVisitors) *
          100
        ).toFixed(1)
      : "0";

  // 로딩 스켈레톤
  const StatCardSkeleton = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">방문 통계</h1>
          <p className="text-muted-foreground">
            사이트 트래픽과 방문자 행동을 분석합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border bg-background p-1">
            {["24h", "7d", "30d", "90d"].map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setDateRange(range);
                  setCustomDays(null);
                  setCustomLabel("");
                }}
                className="px-3"
              >
                {range === "24h"
                  ? "24시간"
                  : range === "7d"
                    ? "7일"
                    : range === "30d"
                      ? "30일"
                      : "90일"}
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
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            내보내기
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
                <Label htmlFor="start-date">시작일</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate || undefined}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-date">종료일</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate || undefined}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              {customStartDate && customEndDate && (
                <p className="text-sm text-muted-foreground">
                  선택 기간:{" "}
                  {Math.ceil(
                    (new Date(customEndDate).getTime() -
                      new Date(customStartDate).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ) + 1}
                  일
                </p>
              )}
              <div className="flex gap-2">
                {[
                  { label: "최근 14일", days: 14 },
                  { label: "최근 60일", days: 60 },
                  { label: "최근 180일", days: 180 },
                ].map((preset) => (
                  <Button
                    key={preset.days}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - preset.days + 1);
                      setCustomStartDate(start.toISOString().split("T")[0]);
                      setCustomEndDate(end.toISOString().split("T")[0]);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCustomDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                onClick={applyCustomDateRange}
                disabled={!customStartDate || !customEndDate}
              >
                적용
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 데이터 없음 알림 */}
      {!loading && visitorData.overview.totalVisitors === 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Loader2 className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            데이터 수집 준비 중입니다. GA4 API가 연결되면 실제 데이터가
            표시됩니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 주요 지표 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 방문자</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {visitorData.overview.totalVisitors.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {visitorData.overview.changes.visitors !== 0 && (
                    <span
                      className={
                        visitorData.overview.changes.visitors >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      <span className="flex items-center gap-1">
                        {visitorData.overview.changes.visitors >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {visitorData.overview.changes.visitors >= 0 ? "+" : ""}
                        {visitorData.overview.changes.visitors.toFixed(1)}%
                      </span>
                    </span>
                  )}
                  지난 기간 대비
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">페이지뷰</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {visitorData.overview.pageViews.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {visitorData.overview.changes.pageViews !== 0 && (
                    <span
                      className={
                        visitorData.overview.changes.pageViews >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      <span className="flex items-center gap-1">
                        {visitorData.overview.changes.pageViews >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {visitorData.overview.changes.pageViews >= 0 ? "+" : ""}
                        {visitorData.overview.changes.pageViews.toFixed(1)}%
                      </span>
                    </span>
                  )}
                  지난 기간 대비
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  평균 체류시간
                </CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {visitorData.overview.avgSessionDuration}
                </div>
                <p className="text-xs text-muted-foreground">
                  {visitorData.overview.changes.avgSessionDuration !== 0 && (
                    <span
                      className={
                        visitorData.overview.changes.avgSessionDuration >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      <span className="flex items-center gap-1">
                        {visitorData.overview.changes.avgSessionDuration >=
                        0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {visitorData.overview.changes.avgSessionDuration >= 0
                          ? "+"
                          : ""}
                        {visitorData.overview.changes.avgSessionDuration.toFixed(
                          1,
                        )}
                        %
                      </span>
                    </span>
                  )}
                  지난 기간 대비
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">이탈률</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {visitorData.overview.bounceRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {visitorData.overview.changes.bounceRate !== 0 && (
                    <span
                      className={
                        visitorData.overview.changes.bounceRate <= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      <span className="flex items-center gap-1">
                        {visitorData.overview.changes.bounceRate <= 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {Math.abs(
                          visitorData.overview.changes.bounceRate,
                        ).toFixed(1)}
                        %
                      </span>
                    </span>
                  )}
                  지난 기간 대비{" "}
                  {visitorData.overview.changes.bounceRate <= 0
                    ? "(감소)"
                    : "(증가)"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 전환 퍼널: 문의 → 계약 → 매출 */}
      {inquiryStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">문의 접수</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inquiryStats.total.toLocaleString()}건
              </div>
              <p className="text-xs text-muted-foreground">
                {visitorData.overview.totalVisitors > 0
                  ? `전환율 ${((inquiryStats.total / visitorData.overview.totalVisitors) * 100).toFixed(1)}%`
                  : "전체 문의 접수"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">계약</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inquiryStats.contractCount}건
              </div>
              <p className="text-xs text-muted-foreground">
                {inquiryStats.total > 0
                  ? `계약률 ${((inquiryStats.contractCount / inquiryStats.total) * 100).toFixed(1)}%`
                  : "계약 완료"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">매출</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inquiryStats.totalRevenue > 0
                  ? `${(inquiryStats.totalRevenue / 10000).toLocaleString()}만원`
                  : "0원"}
              </div>
              <p className="text-xs text-muted-foreground">
                {inquiryStats.contractCount > 0 && inquiryStats.totalRevenue > 0
                  ? `건당 ${(inquiryStats.totalRevenue / inquiryStats.contractCount / 10000).toFixed(0)}만원`
                  : "계약 매출 합계"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 방문자 유형 */}
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">신규 방문자</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {visitorData.overview.newVisitors.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  전체의 {newVisitorPercent}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">재방문자</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {visitorData.overview.returningVisitors.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  전체의 {returningVisitorPercent}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">고유 방문자</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {visitorData.overview.uniqueVisitors.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">중복 제외</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 봇 트래픽 통계 */}
      {botStats && botStats.total_visits > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5" />봇 트래픽 분석
              {botStats.tracking_since && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (추적 시작:{" "}
                  {new Date(botStats.tracking_since).toLocaleDateString(
                    "ko-KR",
                  )}
                  )
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-sm text-muted-foreground">전체 방문</p>
                <p className="text-2xl font-bold">
                  {botStats.total_visits.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-sm text-blue-600">일반 방문자</p>
                <p className="text-2xl font-bold text-blue-700">
                  {botStats.human_visits.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50">
                <p className="text-sm text-orange-600">봇 방문</p>
                <p className="text-2xl font-bold text-orange-700">
                  {botStats.bot_visits.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <p className="text-sm text-red-600 flex items-center justify-center gap-1">
                  <ShieldAlert className="h-3 w-3" />봇 비율
                </p>
                <p className="text-2xl font-bold text-red-700">
                  {botStats.bot_percentage}%
                </p>
              </div>
            </div>

            {botStats.categories.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-3">봇 카테고리별</h4>
                  <div className="space-y-2">
                    {botStats.categories.map((cat) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-orange-400"
                              style={{
                                width: `${Math.min(parseFloat(cat.percentage), 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {cat.count}회 ({cat.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {botStats.top_bots.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">상위 봇</h4>
                    <div className="space-y-1.5">
                      {botStats.top_bots.map((bot, i) => (
                        <div
                          key={bot.name}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">
                              {i + 1}.
                            </span>
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              {bot.name}
                            </code>
                          </span>
                          <span className="text-muted-foreground">
                            {bot.count}회
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 날짜별 히트맵 */}
      <VisitorHeatmap
        daily={aggregatedData?.daily || []}
        loading={aggregatedLoading}
      />

      {/* 탭 콘텐츠 */}
      <Tabs defaultValue="pages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pages">페이지별</TabsTrigger>
          <TabsTrigger value="devices">기기별</TabsTrigger>
          <TabsTrigger value="location">지역별</TabsTrigger>
          <TabsTrigger value="time">시간대별</TabsTrigger>
        </TabsList>

        {/* 페이지별 탭 */}
        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>페이지별 통계</CardTitle>
              <CardDescription>
                각 페이지의 조회수와 사용자 행동
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : visitorData.pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>페이지</TableHead>
                      <TableHead className="text-right">조회수</TableHead>
                      <TableHead className="text-right">고유 조회수</TableHead>
                      <TableHead className="text-right">평균 체류</TableHead>
                      <TableHead className="text-right">이탈률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitorData.pages.map((page) => (
                      <TableRow key={page.path}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{page.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {page.path}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {page.views.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {page.uniqueViews.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {page.avgTime}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              page.bounceRate < 35
                                ? "default"
                                : page.bounceRate < 50
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {page.bounceRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 기기별 탭 */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>기기 유형</CardTitle>
                <CardDescription>방문자가 사용하는 기기 분포</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : visitorData.devices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    데이터가 없습니다.
                  </div>
                ) : (
                  visitorData.devices.map((device) => {
                    const Icon = deviceIcons[device.device] || Monitor;
                    return (
                      <div
                        key={device.device}
                        className="flex items-center gap-4"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{device.device}</span>
                            <span className="text-sm text-muted-foreground">
                              {device.visitors.toLocaleString()} (
                              {device.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${device.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>브라우저</CardTitle>
                <CardDescription>방문자가 사용하는 브라우저</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : visitorData.browsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    데이터가 없습니다.
                  </div>
                ) : (
                  visitorData.browsers.map((browser) => (
                    <div
                      key={browser.browser}
                      className="flex items-center gap-4"
                    >
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{browser.browser}</span>
                          <span className="text-sm text-muted-foreground">
                            {browser.visitors.toLocaleString()} (
                            {browser.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${browser.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 지역별 탭 */}
        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>지역별 방문자</CardTitle>
              <CardDescription>방문자의 접속 지역 분포</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : visitorData.regions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>지역</TableHead>
                      <TableHead className="text-right">방문자</TableHead>
                      <TableHead className="text-right">비율</TableHead>
                      <TableHead className="w-[200px]">분포</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitorData.regions.map((region) => (
                      <TableRow key={region.region}>
                        <TableCell className="font-medium">
                          {region.region}
                        </TableCell>
                        <TableCell className="text-right">
                          {region.visitors.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {region.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${region.percentage}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 시간대별 탭 */}
        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>시간대별 트래픽</CardTitle>
              <CardDescription>하루 중 방문이 집중되는 시간대</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : visitorData.hourlyTraffic.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {visitorData.hourlyTraffic.map((item) => {
                      const maxVisitors = Math.max(
                        ...visitorData.hourlyTraffic.map((h) => h.visitors),
                        1,
                      );
                      const percentage = (item.visitors / maxVisitors) * 100;
                      return (
                        <div
                          key={item.hour}
                          className="flex items-center gap-4"
                        >
                          <span className="w-16 text-sm font-medium">
                            {item.hour}
                          </span>
                          <div className="flex-1">
                            <div className="h-8 rounded bg-muted relative">
                              <div
                                className="h-8 rounded bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage > 10 && (
                                  <span className="text-xs text-white font-medium">
                                    {item.visitors}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const maxItem = visitorData.hourlyTraffic.reduce(
                      (max, item) =>
                        item.visitors > max.visitors ? item : max,
                      visitorData.hourlyTraffic[0],
                    );
                    return (
                      <p className="text-sm text-muted-foreground mt-4">
                        * 가장 많은 방문이 발생하는 시간대:{" "}
                        <strong>{maxItem?.hour}</strong>
                      </p>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 누적 데이터 섹션 */}
      <VisitorPeriodTable
        daily={aggregatedData?.daily || []}
        weekly={aggregatedData?.weekly || []}
        monthly={aggregatedData?.monthly || []}
        summary={aggregatedData?.summary}
        loading={aggregatedLoading}
      />
    </div>
  );
}

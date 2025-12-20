"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Clock,
  ArrowRight,
  Globe,
  Search,
  Share2,
  Link as LinkIcon,
  Monitor,
  Smartphone,
  Calendar,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PeriodCompareData, TrafficSourcesData } from "@/types/analytics"

// 채널 아이콘 매핑
const channelIcons: Record<string, typeof Globe> = {
  organic: Search,
  direct: Globe,
  social: Share2,
  referral: LinkIcon,
  paid: TrendingUp,
}

// 채널 한글명 매핑
const channelLabels: Record<string, string> = {
  organic: "자연 검색",
  direct: "직접 유입",
  social: "소셜 미디어",
  referral: "추천 트래픽",
  paid: "유료 광고",
}

// 숫자 포맷 함수
function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR")
}

// 시간 포맷 함수
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// 비교 카드 컴포넌트
interface CompareCardProps {
  title: string
  currentValue: number | string
  previousValue: number | string
  change: number
  format?: "number" | "duration" | "percentage"
  icon: typeof Users
  positive?: "up" | "down" // 어떤 방향이 긍정적인지
}

function CompareCard({
  title,
  currentValue,
  previousValue,
  change,
  format = "number",
  icon: Icon,
  positive = "up",
}: CompareCardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === "string") return val
    if (format === "duration") return formatDuration(val)
    if (format === "percentage") return `${val.toFixed(1)}%`
    return formatNumber(val)
  }

  const isPositive = positive === "up" ? change > 0 : change < 0
  const changeColor = isPositive ? "text-green-600" : "text-red-600"
  const ChangeIcon = change > 0 ? TrendingUp : TrendingDown

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold">{formatValue(currentValue)}</div>
            <p className="text-xs text-muted-foreground">
              이전: {formatValue(previousValue)}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-sm ${changeColor}`}>
            <ChangeIcon className="h-4 w-4" />
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function InsightsPage() {
  const [comparePreset, setComparePreset] = useState<"week" | "month">("week")
  const [compareData, setCompareData] = useState<PeriodCompareData | null>(null)
  const [compareLoading, setCompareLoading] = useState(true)
  const [trafficData, setTrafficData] = useState<TrafficSourcesData | null>(null)
  const [trafficLoading, setTrafficLoading] = useState(true)

  // 기간 비교 데이터 조회
  useEffect(() => {
    const fetchCompareData = async () => {
      try {
        setCompareLoading(true)
        const response = await fetch(`/api/analytics/compare?preset=${comparePreset}`)
        if (response.ok) {
          const data = await response.json()
          setCompareData(data)
        }
      } catch (error) {
        console.error("Failed to fetch compare data:", error)
      } finally {
        setCompareLoading(false)
      }
    }

    fetchCompareData()
  }, [comparePreset])

  // 트래픽 유입 데이터 조회
  useEffect(() => {
    const fetchTrafficData = async () => {
      try {
        setTrafficLoading(true)
        const response = await fetch("/api/analytics/traffic-sources")
        if (response.ok) {
          const data = await response.json()
          setTrafficData(data)
        }
      } catch (error) {
        console.error("Failed to fetch traffic data:", error)
      } finally {
        setTrafficLoading(false)
      }
    }

    fetchTrafficData()
  }, [])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">방문 분석</h1>
          <p className="text-muted-foreground">
            기간별 트래픽 비교와 유입 채널을 심층 분석합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCompareLoading(true)
              setTrafficLoading(true)
              // 데이터 새로고침
              window.location.reload()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 섹션 1: 기간 비교 분석 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">기간 비교 분석</h2>
          <div className="flex rounded-lg border bg-background p-1">
            <Button
              variant={comparePreset === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setComparePreset("week")}
              className="px-3"
            >
              이번 주 vs 지난 주
            </Button>
            <Button
              variant={comparePreset === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setComparePreset("month")}
              className="px-3"
            >
              이번 달 vs 지난 달
            </Button>
          </div>
        </div>

        {/* 기간 표시 */}
        {compareData && !compareLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {compareData.current.startDate} ~ {compareData.current.endDate}
            </span>
            <ArrowRight className="h-4 w-4" />
            <span>
              {compareData.previous.startDate} ~ {compareData.previous.endDate}
            </span>
          </div>
        )}

        {/* 비교 카드 그리드 */}
        {compareLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : compareData ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CompareCard
              title="방문자"
              currentValue={compareData.current.visitors}
              previousValue={compareData.previous.visitors}
              change={compareData.changes.visitors_percent}
              icon={Users}
            />
            <CompareCard
              title="페이지뷰"
              currentValue={compareData.current.pageviews}
              previousValue={compareData.previous.pageviews}
              change={compareData.changes.pageviews_percent}
              icon={Eye}
            />
            <CompareCard
              title="세션"
              currentValue={compareData.current.sessions}
              previousValue={compareData.previous.sessions}
              change={compareData.changes.sessions_percent}
              icon={Globe}
            />
            <CompareCard
              title="평균 체류시간"
              currentValue={compareData.current.avgDuration}
              previousValue={compareData.previous.avgDuration}
              change={compareData.changes.avgDuration_percent}
              format="duration"
              icon={Clock}
            />
            <CompareCard
              title="이탈률"
              currentValue={compareData.current.bounceRate}
              previousValue={compareData.previous.bounceRate}
              change={compareData.changes.bounceRate_percent}
              format="percentage"
              icon={TrendingDown}
              positive="down"
            />
            <CompareCard
              title="신규 방문자"
              currentValue={compareData.current.newUsers}
              previousValue={compareData.previous.newUsers}
              change={compareData.changes.newUsers_percent}
              icon={Users}
            />
          </div>
        ) : null}
      </div>

      {/* 섹션 2: 트래픽 유입 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>트래픽 유입 분석</CardTitle>
          <CardDescription>
            채널별 방문자 분포와 성과를 분석합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="channels" className="space-y-4">
            <TabsList>
              <TabsTrigger value="channels">유입 채널</TabsTrigger>
              <TabsTrigger value="sources">유입 출처</TabsTrigger>
              <TabsTrigger value="referrers">추천 사이트</TabsTrigger>
            </TabsList>

            {/* 채널별 탭 */}
            <TabsContent value="channels" className="space-y-4">
              {trafficLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : trafficData?.channels ? (
                <div className="space-y-4">
                  {trafficData.channels.map((channel) => {
                    const Icon = channelIcons[channel.channel] || Globe
                    const label = channelLabels[channel.channel] || channel.channel
                    return (
                      <div
                        key={channel.channel}
                        className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{label}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatNumber(channel.visitors)}명 ({channel.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${channel.percentage}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>이탈률: {channel.bounceRate.toFixed(1)}%</span>
                            <span>체류시간: {formatDuration(channel.avgDuration)}</span>
                            {channel.cvr !== undefined && (
                              <span>전환율: {channel.cvr.toFixed(1)}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              )}
            </TabsContent>

            {/* 출처별 탭 */}
            <TabsContent value="sources" className="space-y-4">
              {trafficLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : trafficData?.sources ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>출처</TableHead>
                      <TableHead>매체</TableHead>
                      <TableHead className="text-right">방문자</TableHead>
                      <TableHead className="text-right">세션</TableHead>
                      <TableHead className="text-right">이탈률</TableHead>
                      <TableHead className="text-right">체류시간</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trafficData.sources.map((source, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{source.source}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{source.medium}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(source.visitors)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(source.sessions)}
                        </TableCell>
                        <TableCell className="text-right">
                          {source.bounceRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(source.avgDuration)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              )}
            </TabsContent>

            {/* 추천 사이트 탭 */}
            <TabsContent value="referrers" className="space-y-4">
              {trafficLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : trafficData?.topReferrers ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>추천 사이트</TableHead>
                      <TableHead>랜딩 페이지</TableHead>
                      <TableHead className="text-right">방문자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trafficData.topReferrers.map((referrer, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[300px]">
                              {referrer.referrer}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {referrer.landingPage}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(referrer.visitors)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  데이터가 없습니다.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 섹션 3: 주요 인사이트 */}
      <Card>
        <CardHeader>
          <CardTitle>주요 인사이트</CardTitle>
          <CardDescription>
            데이터 기반 분석 결과와 권장 사항
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
              <h4 className="font-medium text-green-700 dark:text-green-400">
                긍정적 트렌드
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-green-600 dark:text-green-300">
                <li>• 자연 검색 유입이 가장 높은 비중을 차지합니다</li>
                <li>• 직접 유입 재방문율이 높아 브랜드 인지도가 상승 중입니다</li>
                <li>• 유료 광고 채널의 전환율이 우수합니다</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                개선 권장사항
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-300">
                <li>• 소셜 미디어 채널의 이탈률이 높습니다 - 콘텐츠 최적화 필요</li>
                <li>• 모바일 사용자 체류시간 개선이 필요합니다</li>
                <li>• 리타겟팅 캠페인으로 재방문율을 높일 수 있습니다</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

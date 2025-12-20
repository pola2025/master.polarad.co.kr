"use client"

import { useState, useEffect } from "react"
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
import { VisitorPeriodTable } from "@/components/dashboard/visitor-period-table"
import type { AggregatedVisitorData } from "@/types/analytics"

// 데모 데이터
const visitorData = {
  overview: {
    totalVisitors: 2847,
    uniqueVisitors: 1923,
    pageViews: 8234,
    avgSessionDuration: "3분 42초",
    bounceRate: 38.5,
    newVisitors: 1245,
    returningVisitors: 678,
  },
  daily: [
    { date: "12/14", visitors: 386, pageviews: 1124, sessions: 412 },
    { date: "12/15", visitors: 445, pageviews: 1367, sessions: 478 },
    { date: "12/16", visitors: 367, pageviews: 1089, sessions: 398 },
    { date: "12/17", visitors: 423, pageviews: 1245, sessions: 456 },
    { date: "12/18", visitors: 398, pageviews: 1178, sessions: 421 },
    { date: "12/19", visitors: 512, pageviews: 1567, sessions: 548 },
    { date: "12/20", visitors: 316, pageviews: 964, sessions: 334 },
  ],
  countries: [
    { country: "대한민국", visitors: 2456, percentage: 86.3 },
    { country: "미국", visitors: 187, percentage: 6.6 },
    { country: "일본", visitors: 98, percentage: 3.4 },
    { country: "중국", visitors: 56, percentage: 2.0 },
    { country: "기타", visitors: 50, percentage: 1.7 },
  ],
  pages: [
    { path: "/", title: "홈페이지", views: 2456, uniqueViews: 1823, avgTime: "2:34", bounceRate: 35.2 },
    { path: "/service", title: "서비스 소개", views: 1567, uniqueViews: 1234, avgTime: "4:12", bounceRate: 28.5 },
    { path: "/blog/tiktok-vpn-guide", title: "틱톡 VPN 가이드", views: 1234, uniqueViews: 987, avgTime: "5:45", bounceRate: 22.3 },
    { path: "/blog/threads-followers", title: "쓰레드 팔로워 늘리기", views: 987, uniqueViews: 756, avgTime: "4:32", bounceRate: 31.2 },
    { path: "/contact", title: "문의하기", views: 654, uniqueViews: 543, avgTime: "1:23", bounceRate: 45.6 },
    { path: "/portfolio", title: "포트폴리오", views: 543, uniqueViews: 432, avgTime: "3:45", bounceRate: 33.4 },
    { path: "/privacy", title: "개인정보처리방침", views: 234, uniqueViews: 198, avgTime: "0:45", bounceRate: 78.9 },
  ],
  devices: [
    { device: "데스크톱", icon: Monitor, visitors: 1423, percentage: 50.0 },
    { device: "모바일", icon: Smartphone, visitors: 1282, percentage: 45.0 },
    { device: "태블릿", icon: Tablet, visitors: 142, percentage: 5.0 },
  ],
  browsers: [
    { browser: "Chrome", visitors: 1654, percentage: 58.1 },
    { browser: "Safari", visitors: 654, percentage: 23.0 },
    { browser: "Edge", visitors: 312, percentage: 11.0 },
    { browser: "Firefox", visitors: 156, percentage: 5.5 },
    { browser: "기타", visitors: 71, percentage: 2.4 },
  ],
  hourlyTraffic: [
    { hour: "00-04", visitors: 89 },
    { hour: "04-08", visitors: 156 },
    { hour: "08-12", visitors: 534 },
    { hour: "12-16", visitors: 678 },
    { hour: "16-20", visitors: 823 },
    { hour: "20-24", visitors: 567 },
  ],
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("7d")
  const [aggregatedData, setAggregatedData] = useState<AggregatedVisitorData | null>(null)
  const [aggregatedLoading, setAggregatedLoading] = useState(true)

  // 누적 데이터 조회
  useEffect(() => {
    const fetchAggregatedData = async () => {
      try {
        setAggregatedLoading(true)
        const days = dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
        const response = await fetch(`/api/analytics/aggregated?days=${days}`)
        if (response.ok) {
          const data = await response.json()
          setAggregatedData(data)
        }
      } catch (error) {
        console.error("Failed to fetch aggregated data:", error)
      } finally {
        setAggregatedLoading(false)
      }
    }

    fetchAggregatedData()
  }, [dateRange])

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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-background p-1">
            {["24h", "7d", "30d", "90d"].map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDateRange(range)}
                className="px-3"
              >
                {range === "24h" ? "24시간" : range === "7d" ? "7일" : range === "30d" ? "30일" : "90일"}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            사용자 지정
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            내보내기
          </Button>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 방문자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitorData.overview.totalVisitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +12.5%
              </span>
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
            <div className="text-2xl font-bold">{visitorData.overview.pageViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +8.3%
              </span>
              지난 기간 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 체류시간</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitorData.overview.avgSessionDuration}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> -2.1%
              </span>
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
            <div className="text-2xl font-bold">{visitorData.overview.bounceRate}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> -3.2%
              </span>
              지난 기간 대비 (감소)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 방문자 유형 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">신규 방문자</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {visitorData.overview.newVisitors.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">전체의 64.8%</p>
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
            <p className="text-sm text-muted-foreground mt-1">전체의 35.2%</p>
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
      </div>

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
              <CardDescription>각 페이지의 조회수와 사용자 행동</CardDescription>
            </CardHeader>
            <CardContent>
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
                          <p className="text-sm text-muted-foreground">{page.path}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {page.views.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {page.uniqueViews.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{page.avgTime}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={page.bounceRate < 35 ? "default" : page.bounceRate < 50 ? "secondary" : "destructive"}>
                          {page.bounceRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                {visitorData.devices.map((device) => (
                  <div key={device.device} className="flex items-center gap-4">
                    <device.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{device.device}</span>
                        <span className="text-sm text-muted-foreground">
                          {device.visitors.toLocaleString()} ({device.percentage}%)
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
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>브라우저</CardTitle>
                <CardDescription>방문자가 사용하는 브라우저</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visitorData.browsers.map((browser) => (
                  <div key={browser.browser} className="flex items-center gap-4">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{browser.browser}</span>
                        <span className="text-sm text-muted-foreground">
                          {browser.visitors.toLocaleString()} ({browser.percentage}%)
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
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 지역별 탭 */}
        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>국가별 방문자</CardTitle>
              <CardDescription>방문자의 국가별 분포</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>국가</TableHead>
                    <TableHead className="text-right">방문자</TableHead>
                    <TableHead className="text-right">비율</TableHead>
                    <TableHead className="w-[200px]">분포</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitorData.countries.map((country) => (
                    <TableRow key={country.country}>
                      <TableCell className="font-medium">{country.country}</TableCell>
                      <TableCell className="text-right">
                        {country.visitors.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{country.percentage}%</TableCell>
                      <TableCell>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${country.percentage}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <div className="space-y-4">
                {visitorData.hourlyTraffic.map((item) => {
                  const maxVisitors = Math.max(...visitorData.hourlyTraffic.map(h => h.visitors))
                  const percentage = (item.visitors / maxVisitors) * 100
                  return (
                    <div key={item.hour} className="flex items-center gap-4">
                      <span className="w-16 text-sm font-medium">{item.hour}</span>
                      <div className="flex-1">
                        <div className="h-8 rounded bg-muted relative">
                          <div
                            className="h-8 rounded bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-2"
                            style={{ width: `${percentage}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {item.visitors}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                * 가장 많은 방문이 발생하는 시간대: <strong>16:00 - 20:00</strong>
              </p>
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
  )
}

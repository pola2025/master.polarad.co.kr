import { Users, Eye, Timer, TrendingDown, AlertCircle, CheckCircle } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { VisitorChart } from "@/components/dashboard/charts/visitor-chart"
import { TrafficSourceChart } from "@/components/dashboard/charts/traffic-source-chart"
import { TopPagesTable } from "@/components/dashboard/top-pages-table"
import { DeviceChart } from "@/components/dashboard/device-chart"
import { SearchQueriesTable } from "@/components/dashboard/search-queries-table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getDailyAnalyticsFromCache,
  getTrafficSourcesFromCache,
  getTopPagesFromCache,
  getDeviceStatsFromCache,
} from "@/lib/airtable-cache"

interface DashboardData {
  overview: {
    totalUsers: number
    pageViews: number
    bounceRate: number
    avgSessionDuration: number
    changes: {
      users: number
      pageViews: number
      bounceRate: number
      avgSessionDuration: number
    }
  }
  daily: Array<{ date: string; visitors: number; pageviews: number }>
  sources: Array<{ source: string; visitors: number }>
  pages: Array<{ path: string; title: string; views: number; avgTime: string }>
  devices: Array<{ device: string; visitors: number }>
  hasData: boolean
  error?: string
}

async function getAnalyticsData(): Promise<DashboardData> {
  try {
    // Airtable 캐시에서 데이터 조회
    const [dailyData, trafficSources, topPages, deviceStats] = await Promise.all([
      getDailyAnalyticsFromCache(30),
      getTrafficSourcesFromCache(),
      getTopPagesFromCache(),
      getDeviceStatsFromCache(),
    ])

    if (dailyData.length === 0) {
      return {
        overview: { totalUsers: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0, changes: { users: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0 } },
        daily: [],
        sources: [],
        pages: [],
        devices: [],
        hasData: false,
      }
    }

    // 최근 7일 데이터
    const last7Days = dailyData.slice(0, 7)
    const prev7Days = dailyData.slice(7, 14)

    // Overview 계산
    const totalUsers = last7Days.reduce((sum, d) => sum + d.visitors, 0)
    const pageViews = last7Days.reduce((sum, d) => sum + d.pageviews, 0)
    const bounceRate = last7Days.length > 0 ? last7Days.reduce((sum, d) => sum + d.bounceRate, 0) / last7Days.length : 0
    const avgSessionDuration = last7Days.length > 0 ? last7Days.reduce((sum, d) => sum + d.avgDuration, 0) / last7Days.length : 0

    // 이전 기간 대비 변화율
    const prevUsers = prev7Days.reduce((sum, d) => sum + d.visitors, 0)
    const prevPageViews = prev7Days.reduce((sum, d) => sum + d.pageviews, 0)
    const prevBounceRate = prev7Days.length > 0 ? prev7Days.reduce((sum, d) => sum + d.bounceRate, 0) / prev7Days.length : 0
    const prevAvgDuration = prev7Days.length > 0 ? prev7Days.reduce((sum, d) => sum + d.avgDuration, 0) / prev7Days.length : 0

    const calcChange = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100

    // 일별 차트 데이터 (MM/DD 형식으로 변환)
    const daily = last7Days.map(d => ({
      date: d.date.slice(5).replace("-", "/"),
      visitors: d.visitors,
      pageviews: d.pageviews,
    })).reverse()

    // 트래픽 소스 데이터
    const sources = trafficSources.map(s => ({
      source: s.channel,
      visitors: s.visitors,
    }))

    // 페이지별 데이터
    const pages = topPages.map(p => ({
      path: p.path,
      title: p.title,
      views: p.views,
      avgTime: p.avgTime,
    }))

    // 기기별 데이터 (한글 → 영문 변환)
    const deviceNameMap: Record<string, string> = {
      '데스크톱': 'desktop',
      '모바일': 'mobile',
      '태블릿': 'tablet',
      'Desktop': 'desktop',
      'Mobile': 'mobile',
      'Tablet': 'tablet',
    }
    const devices = deviceStats.map(d => ({
      device: deviceNameMap[d.device] || d.device.toLowerCase(),
      visitors: d.visitors,
    }))

    return {
      overview: {
        totalUsers,
        pageViews,
        bounceRate,
        avgSessionDuration,
        changes: {
          users: calcChange(totalUsers, prevUsers),
          pageViews: calcChange(pageViews, prevPageViews),
          bounceRate: calcChange(bounceRate, prevBounceRate),
          avgSessionDuration: calcChange(avgSessionDuration, prevAvgDuration),
        },
      },
      daily,
      sources,
      pages,
      devices,
      hasData: true,
    }
  } catch (error: unknown) {
    console.error("Error fetching analytics from Airtable:", error)
    return {
      overview: { totalUsers: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0, changes: { users: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0 } },
      daily: [],
      sources: [],
      pages: [],
      devices: [],
      hasData: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}분 ${secs}초`
}

export default async function DashboardPage() {
  const data = await getAnalyticsData()
  const { overview, daily, sources, pages, devices, hasData, error } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          polarad.co.kr 사이트 현황을 한눈에 확인하세요.
        </p>
      </div>

      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            데이터를 불러오는 중 오류가 발생했습니다: {error}
          </AlertDescription>
        </Alert>
      )}

      {!hasData && !error && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            저장된 통계 데이터가 없습니다.
          </AlertDescription>
        </Alert>
      )}

      {hasData && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Airtable에 저장된 통계 데이터를 표시하고 있습니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="오늘 방문자"
          value={overview.totalUsers.toLocaleString()}
          icon={Users}
          trend={{
            value: Math.abs(overview.changes.users),
            isPositive: overview.changes.users >= 0,
          }}
          description="어제 대비"
        />
        <StatCard
          title="페이지뷰"
          value={overview.pageViews.toLocaleString()}
          icon={Eye}
          trend={{
            value: Math.abs(overview.changes.pageViews),
            isPositive: overview.changes.pageViews >= 0,
          }}
          description="어제 대비"
        />
        <StatCard
          title="평균 체류시간"
          value={formatDuration(overview.avgSessionDuration)}
          icon={Timer}
          trend={{
            value: Math.abs(overview.changes.avgSessionDuration),
            isPositive: overview.changes.avgSessionDuration >= 0,
          }}
          description="어제 대비"
        />
        <StatCard
          title="이탈률"
          value={`${overview.bounceRate.toFixed(1)}%`}
          icon={TrendingDown}
          trend={{
            value: Math.abs(overview.changes.bounceRate),
            isPositive: overview.changes.bounceRate <= 0, // 이탈률은 낮을수록 좋음
          }}
          description={overview.changes.bounceRate <= 0 ? "어제 대비 (감소)" : "어제 대비 (증가)"}
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid gap-4 md:grid-cols-2">
        <VisitorChart data={daily} />
        <TrafficSourceChart data={sources} />
      </div>

      {/* 테이블 및 추가 차트 */}
      <div className="grid gap-4 md:grid-cols-2">
        <TopPagesTable data={pages} />
        <DeviceChart data={devices} />
      </div>

      {/* 검색어 섹션 */}
      <div className="grid gap-4">
        <SearchQueriesTable />
      </div>
    </div>
  )
}

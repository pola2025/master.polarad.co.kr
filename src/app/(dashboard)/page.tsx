import { Users, Eye, Timer, TrendingDown, AlertCircle, CheckCircle } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { VisitorChart } from "@/components/dashboard/charts/visitor-chart"
import { TrafficSourceChart } from "@/components/dashboard/charts/traffic-source-chart"
import { TopPagesTable } from "@/components/dashboard/top-pages-table"
import { DeviceChart } from "@/components/dashboard/device-chart"
import { SearchQueriesTable } from "@/components/dashboard/search-queries-table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getDashboardData } from "@/lib/google-analytics"

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
  isDemoData?: boolean
  isRateLimited?: boolean
}

// 데모 데이터
const DEMO_DATA: DashboardData = {
  overview: {
    totalUsers: 198,
    pageViews: 334,
    bounceRate: 42.3,
    avgSessionDuration: 154,
    changes: {
      users: 12.5,
      pageViews: 8.2,
      bounceRate: -5.4,
      avgSessionDuration: -3.1,
    },
  },
  daily: [
    { date: "12/14", visitors: 186, pageviews: 312 },
    { date: "12/15", visitors: 305, pageviews: 521 },
    { date: "12/16", visitors: 237, pageviews: 408 },
    { date: "12/17", visitors: 173, pageviews: 289 },
    { date: "12/18", visitors: 209, pageviews: 367 },
    { date: "12/19", visitors: 264, pageviews: 445 },
    { date: "12/20", visitors: 198, pageviews: 334 },
  ],
  sources: [
    { source: "direct", visitors: 450 },
    { source: "organic", visitors: 380 },
    { source: "referral", visitors: 220 },
    { source: "social", visitors: 150 },
  ],
  pages: [
    { path: "/", title: "홈", views: 1234, avgTime: "2:34" },
    { path: "/service", title: "서비스 소개", views: 856, avgTime: "3:12" },
    { path: "/marketing-news", title: "마케팅 뉴스", views: 623, avgTime: "4:21" },
    { path: "/contact", title: "문의하기", views: 412, avgTime: "1:45" },
    { path: "/portfolio", title: "포트폴리오", views: 287, avgTime: "2:58" },
  ],
  devices: [
    { device: "mobile", visitors: 680 },
    { device: "desktop", visitors: 450 },
    { device: "tablet", visitors: 70 },
  ],
  isDemoData: true,
}

async function getAnalyticsData(): Promise<DashboardData> {
  // 환경 변수 확인
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return DEMO_DATA
  }

  try {
    // 서버에서 직접 GA4 API 호출 (캐싱 적용)
    const data = await getDashboardData()
    return {
      overview: {
        totalUsers: data.overview.totalUsers,
        pageViews: data.overview.pageViews,
        bounceRate: data.overview.bounceRate,
        avgSessionDuration: data.overview.avgSessionDuration,
        changes: data.overview.changes,
      },
      daily: data.daily,
      sources: data.sources,
      pages: data.pages,
      devices: data.devices,
      isDemoData: false,
    }
  } catch (error: unknown) {
    console.error("Error fetching analytics:", error)
    // Rate limit 에러 확인
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
      return { ...DEMO_DATA, isDemoData: false, isRateLimited: true }
    }
    return DEMO_DATA
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}분 ${secs}초`
}

export default async function DashboardPage() {
  const data = await getAnalyticsData()
  const { overview, daily, sources, pages, devices, isDemoData, isRateLimited } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          polarad.co.kr 사이트 현황을 한눈에 확인하세요.
        </p>
      </div>

      {isDemoData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            GA4 API가 연결되지 않아 데모 데이터를 표시하고 있습니다.
            실제 데이터를 보려면 환경 변수를 설정하세요.
          </AlertDescription>
        </Alert>
      )}

      {isRateLimited && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            GA4 API 요청 한도 초과로 일시적으로 데모 데이터를 표시합니다.
            잠시 후 새로고침 해주세요.
          </AlertDescription>
        </Alert>
      )}

      {!isDemoData && !isRateLimited && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            GA4 API가 정상적으로 연결되어 실제 데이터를 표시하고 있습니다.
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

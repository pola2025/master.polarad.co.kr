"use client"

import { useState, useEffect } from "react"
import {
  Search,
  TrendingUp,
  MousePointer,
  Eye,
  Target,
  Calendar,
  Loader2,
  AlertCircle,
  Trophy,
  Clock,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface SearchData {
  queries: SearchQuery[]
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  period?: string
}

type PeriodType = "weekly" | "monthly" | "cumulative" | "custom"

export default function KeywordsPage() {
  const [activeTab, setActiveTab] = useState<PeriodType>("weekly")
  const [data, setData] = useState<Record<PeriodType, SearchData | null>>({
    weekly: null,
    monthly: null,
    cumulative: null,
    custom: null,
  })
  const [loading, setLoading] = useState<Record<PeriodType, boolean>>({
    weekly: false,
    monthly: false,
    cumulative: false,
    custom: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  })

  const fetchData = async (period: PeriodType, startDate?: string, endDate?: string) => {
    setLoading((prev) => ({ ...prev, [period]: true }))
    setError(null)

    try {
      let url = `/api/search-queries?period=${period}&limit=10`
      if (period === "custom" && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      }

      const response = await fetch(url)

      if (response.status === 501) {
        setError("데이터 수집 준비 중입니다.")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch data")
      }

      const result = await response.json()
      setData((prev) => ({ ...prev, [period]: result }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다.")
    } finally {
      setLoading((prev) => ({ ...prev, [period]: false }))
    }
  }

  useEffect(() => {
    fetchData("weekly")
    fetchData("monthly")
    fetchData("cumulative")
  }, [])

  const handleCustomSearch = () => {
    if (customDateRange.startDate && customDateRange.endDate) {
      fetchData("custom", customDateRange.startDate, customDateRange.endDate)
    }
  }

  const currentData = data[activeTab]
  const isLoading = loading[activeTab]

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">1위</Badge>
    if (index === 1) return <Badge className="bg-gray-400">2위</Badge>
    if (index === 2) return <Badge className="bg-amber-600">3위</Badge>
    return <Badge variant="outline">{index + 1}위</Badge>
  }

  const getPositionColor = (position: number) => {
    if (position <= 3) return "text-green-600"
    if (position <= 10) return "text-blue-600"
    if (position <= 20) return "text-yellow-600"
    return "text-red-600"
  }

  const periodLabels: Record<PeriodType, string> = {
    weekly: "주간 (7일)",
    monthly: "월간 (30일)",
    cumulative: "누적 (전체)",
    custom: "기간 지정",
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">유입 검색어 분석</h1>
          <p className="text-muted-foreground">
            Google Search Console 기반 검색어 순위 분석
          </p>
        </div>
      </div>

      {/* 에러 상태 */}
      {error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PeriodType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cumulative" className="gap-2">
            <Trophy className="h-4 w-4" />
            누적
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            <Clock className="h-4 w-4" />
            주간
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            월간
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <Calendar className="h-4 w-4" />
            기간 지정
          </TabsTrigger>
        </TabsList>

        {/* 기간 지정 입력 */}
        <TabsContent value="custom" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기간 선택</CardTitle>
              <CardDescription>분석할 기간을 직접 지정하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">시작일</label>
                  <Input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) =>
                      setCustomDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">종료일</label>
                  <Input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) =>
                      setCustomDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                  />
                </div>
                <Button
                  onClick={handleCustomSearch}
                  disabled={!customDateRange.startDate || !customDateRange.endDate || loading.custom}
                >
                  {loading.custom ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  조회
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 요약 통계 */}
      {currentData && !isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 클릭</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentData.totalClicks.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{periodLabels[activeTab]}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 노출</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentData.totalImpressions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{periodLabels[activeTab]}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 CTR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentData.avgCtr.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">클릭률</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 순위</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPositionColor(currentData.avgPosition)}`}>
                {currentData.avgPosition.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">검색 결과 위치</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 검색어 순위 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            검색어 순위 TOP 10
          </CardTitle>
          <CardDescription>
            {periodLabels[activeTab]} 기준 상위 검색어
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !currentData || currentData.queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">검색어 데이터가 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "custom"
                  ? "기간을 선택하고 조회 버튼을 클릭하세요."
                  : "데이터가 수집되면 여기에 표시됩니다."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">순위</TableHead>
                  <TableHead>검색어</TableHead>
                  <TableHead className="text-right">클릭</TableHead>
                  <TableHead className="text-right">노출</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">평균 순위</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.queries.map((query, index) => (
                  <TableRow key={query.query}>
                    <TableCell>{getRankBadge(index)}</TableCell>
                    <TableCell className="font-medium">{query.query}</TableCell>
                    <TableCell className="text-right">{query.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{query.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{query.ctr.toFixed(2)}%</TableCell>
                    <TableCell className={`text-right font-medium ${getPositionColor(query.position)}`}>
                      {query.position.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

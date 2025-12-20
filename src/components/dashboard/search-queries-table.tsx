"use client"

import { useState, useEffect } from "react"
import { Search, TrendingUp, Eye, MousePointer, Loader2, AlertCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
}

function getPositionBadgeColor(position: number): string {
  if (position <= 3) return "bg-green-100 text-green-700 border-green-200"
  if (position <= 10) return "bg-blue-100 text-blue-700 border-blue-200"
  if (position <= 20) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

export function SearchQueriesTable() {
  const [data, setData] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/search-queries?period=weekly&limit=5")

        if (response.status === 501) {
          setError("데이터 수집 준비 중")
          return
        }

        if (!response.ok) {
          throw new Error("Failed to fetch")
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError("데이터를 불러올 수 없습니다")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            유입 검색어
          </CardTitle>
          <CardDescription>Google Search Console 기준 최근 7일</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data || data.queries.length === 0) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            유입 검색어
          </CardTitle>
          <CardDescription>Google Search Console 기준 최근 7일</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">
            {error || "검색어 데이터가 없습니다"}
          </h3>
          <p className="text-sm text-muted-foreground">
            데이터가 수집되면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              유입 검색어
            </CardTitle>
            <CardDescription>Google Search Console 기준 최근 7일</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">클릭</span>
              <span className="font-semibold">{data.totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">노출</span>
              <span className="font-semibold">{data.totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">평균순위</span>
              <span className="font-semibold">{data.avgPosition.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>검색어</TableHead>
              <TableHead className="text-right">클릭</TableHead>
              <TableHead className="text-right">노출</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">순위</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.queries.slice(0, 5).map((item, index) => (
              <TableRow key={item.query}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-4">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item.query}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.impressions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.ctr.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={getPositionBadgeColor(item.position)}
                  >
                    {item.position.toFixed(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href="/analytics/keywords">
              전체 검색어 분석 보기
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

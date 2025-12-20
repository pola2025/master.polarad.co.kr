"use client"

import { useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ArrowUpDown, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import type { CampaignData } from "@/types/analytics"

interface CampaignPerformanceTableProps {
  data?: CampaignData[]
  loading?: boolean
  className?: string
}

// 체류시간 포맷 (초 -> 분:초)
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// 매체 배지 색상
function getMediumBadgeVariant(medium: string): "default" | "secondary" | "outline" | "destructive" {
  switch (medium.toLowerCase()) {
    case "cpc":
    case "ppc":
      return "default"
    case "cpm":
    case "display":
      return "secondary"
    case "email":
      return "outline"
    case "social":
      return "secondary"
    default:
      return "outline"
  }
}

// 소스 아이콘/이름 매핑
function getSourceDisplay(source: string): string {
  const mapping: Record<string, string> = {
    google: "Google",
    facebook: "Facebook",
    instagram: "Instagram",
    naver: "Naver",
    kakao: "KakaoTalk",
    email: "Email",
  }
  return mapping[source.toLowerCase()] || source
}

type SortKey = "visitors" | "conversions" | "cvr" | "bounceRate" | "avgDuration"

export function CampaignPerformanceTable({
  data,
  loading = false,
  className,
}: CampaignPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("visitors")
  const [sortDesc, setSortDesc] = useState(true)

  // 정렬 처리
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const sortedData = data
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        return sortDesc ? bVal - aVal : aVal - bVal
      })
    : []

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>캠페인 성과</CardTitle>
          <CardDescription>UTM 캠페인별 성과 분석</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>캠페인 성과</CardTitle>
          <CardDescription>UTM 캠페인별 성과 분석</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            UTM 캠페인 데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>캠페인 성과</CardTitle>
        <CardDescription>
          총 {data.length}개 캠페인 | 전체 전환 {data.reduce((sum, c) => sum + c.conversions, 0).toLocaleString()}건
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">캠페인</TableHead>
              <TableHead className="text-center">소스/매체</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("visitors")}
              >
                <span className="inline-flex items-center gap-1">
                  방문자
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("conversions")}
              >
                <span className="inline-flex items-center gap-1">
                  전환
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("cvr")}
              >
                <span className="inline-flex items-center gap-1">
                  전환율
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("bounceRate")}
              >
                <span className="inline-flex items-center gap-1">
                  이탈률
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("avgDuration")}
              >
                <span className="inline-flex items-center gap-1">
                  체류시간
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((campaign, index) => (
              <TableRow key={`${campaign.campaign}-${campaign.source}-${index}`}>
                <TableCell>
                  <div className="font-medium truncate max-w-[200px]" title={campaign.campaign}>
                    {campaign.campaign}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm text-muted-foreground">
                      {getSourceDisplay(campaign.source)}
                    </span>
                    <Badge variant={getMediumBadgeVariant(campaign.medium)} className="text-xs">
                      {campaign.medium}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {campaign.visitors.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-primary">
                    {campaign.conversions.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "font-medium",
                      campaign.cvr >= 2 ? "text-green-600" : campaign.cvr >= 1 ? "text-amber-600" : "text-muted-foreground"
                    )}
                  >
                    {campaign.cvr.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      campaign.bounceRate <= 35 ? "text-green-600" : campaign.bounceRate <= 50 ? "text-amber-600" : "text-red-600"
                    )}
                  >
                    {campaign.bounceRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDuration(campaign.avgDuration)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

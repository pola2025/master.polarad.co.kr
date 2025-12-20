"use client"

import { useState, useEffect } from "react"
import {
  Megaphone,
  Target,
  TrendingUp,
  Users,
  MousePointerClick,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { CampaignPerformanceTable } from "@/components/dashboard/campaign-performance-table"
import { ConversionGoalsCard } from "@/components/dashboard/conversion-goals-card"
import { FunnelChart } from "@/components/dashboard/charts/funnel-chart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { CampaignAnalyticsData, ConversionAnalyticsData, FunnelStep } from "@/types/analytics"

export default function CampaignsPage() {
  const [campaignData, setCampaignData] = useState<CampaignAnalyticsData | null>(null)
  const [campaignLoading, setCampaignLoading] = useState(true)
  const [conversionData, setConversionData] = useState<ConversionAnalyticsData & { steps?: FunnelStep[] } | null>(null)
  const [conversionLoading, setConversionLoading] = useState(true)
  const [isNotConfigured, setIsNotConfigured] = useState(false)

  // 캠페인 데이터 조회
  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        setCampaignLoading(true)
        const response = await fetch("/api/analytics/campaigns")
        if (response.status === 501) {
          setIsNotConfigured(true)
          return
        }
        if (response.ok) {
          const data = await response.json()
          setCampaignData(data)
        }
      } catch (error) {
        console.error("Failed to fetch campaign data:", error)
      } finally {
        setCampaignLoading(false)
      }
    }

    fetchCampaignData()
  }, [])

  // 전환 데이터 조회
  useEffect(() => {
    const fetchConversionData = async () => {
      try {
        setConversionLoading(true)
        const response = await fetch("/api/analytics/conversions?funnel=true")
        if (response.status === 501) {
          setIsNotConfigured(true)
          return
        }
        if (response.ok) {
          const data = await response.json()
          setConversionData(data)
        }
      } catch (error) {
        console.error("Failed to fetch conversion data:", error)
      } finally {
        setConversionLoading(false)
      }
    }

    fetchConversionData()
  }, [])

  // 새로고침
  const handleRefresh = () => {
    setCampaignLoading(true)
    setConversionLoading(true)
    window.location.reload()
  }

  // 요약 통계 계산
  const totalCampaigns = campaignData?.summary.total_campaigns || 0
  const totalVisitors = campaignData?.summary.total_visitors || 0
  const totalConversions = campaignData?.summary.total_conversions || 0
  const avgCvr = campaignData?.summary.avg_cvr || 0
  const totalConversionValue = conversionData?.goals?.reduce((sum, g) => sum + g.conversion_value, 0) || 0

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            캠페인 분석
          </h1>
          <p className="text-muted-foreground">
            UTM 캠페인 성과와 전환 목표를 분석합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      {isNotConfigured && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Loader2 className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            데이터 수집 준비 중입니다. GA4 API 연결이 완료되면 실제 데이터가 표시됩니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 요약 카드 */}
      {campaignLoading || conversionLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="캠페인 수"
            value={totalCampaigns}
            description="활성 캠페인"
            icon={Megaphone}
          />
          <StatCard
            title="캠페인 방문자"
            value={totalVisitors.toLocaleString()}
            description="UTM 캠페인 통한 유입"
            icon={Users}
          />
          <StatCard
            title="총 전환"
            value={totalConversions.toLocaleString()}
            description={`전환율 ${avgCvr.toFixed(2)}%`}
            icon={MousePointerClick}
            trend={avgCvr >= 2 ? { value: avgCvr, isPositive: true } : undefined}
          />
          <StatCard
            title="전환 가치"
            value={`${(totalConversionValue / 10000).toFixed(0)}만원`}
            description="예상 전환 가치"
            icon={Target}
          />
        </div>
      )}

      {/* 캠페인 성과 테이블 */}
      <CampaignPerformanceTable
        data={campaignData?.campaigns}
        loading={campaignLoading}
      />

      {/* 전환 목표 및 채널별 성과 */}
      <ConversionGoalsCard
        goals={conversionData?.goals}
        byChannel={conversionData?.by_channel}
        loading={conversionLoading}
      />

      {/* 마케팅 퍼널 */}
      <FunnelChart
        steps={conversionData?.steps}
        funnel={conversionData?.funnel}
        loading={conversionLoading}
      />

      {/* 인사이트 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            마케팅 인사이트
          </CardTitle>
          <CardDescription>
            데이터 기반 분석 결과와 권장 사항
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 캠페인 성과 인사이트 */}
            <div className="p-4 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <h4 className="font-medium text-blue-700 dark:text-blue-400">
                캠페인 성과
              </h4>
              {campaignData?.campaigns && campaignData.campaigns.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-blue-600 dark:text-blue-300">
                  {campaignData.campaigns.slice(0, 3).map((c, i) => (
                    <li key={i}>
                      • <strong>{c.campaign}</strong>: {c.visitors.toLocaleString()}명 방문,
                      전환율 {c.cvr.toFixed(2)}%
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-300">
                  UTM 캠페인 데이터가 없습니다.
                </p>
              )}
            </div>

            {/* 전환 최적화 인사이트 */}
            <div className="p-4 rounded-lg border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
              <h4 className="font-medium text-green-700 dark:text-green-400">
                전환 최적화
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-green-600 dark:text-green-300">
                {conversionData?.by_channel?.slice(0, 2).map((c, i) => (
                  <li key={i}>
                    • <strong>{c.channel === "email" ? "이메일" : c.channel === "organic" ? "자연검색" : c.channel === "direct" ? "직접유입" : c.channel}</strong>
                    채널 전환율 {c.cvr.toFixed(1)}%로 우수
                  </li>
                ))}
                {conversionData?.funnel && (
                  <li>
                    • 퍼널 전체 전환율:{" "}
                    {conversionData.funnel.acquisition > 0
                      ? ((conversionData.funnel.conversion / conversionData.funnel.acquisition) * 100).toFixed(1)
                      : 0}%
                  </li>
                )}
              </ul>
            </div>

            {/* 개선 권장사항 */}
            <div className="p-4 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                개선 권장사항
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-300">
                <li>• 이탈률이 높은 캠페인의 랜딩페이지 최적화 필요</li>
                <li>• 전환율 2% 미만 캠페인은 타겟팅 재검토 권장</li>
                <li>• 이메일 캠페인의 고성과 활용 확대 검토</li>
              </ul>
            </div>

            {/* 액션 아이템 */}
            <div className="p-4 rounded-lg border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-950/20">
              <h4 className="font-medium text-purple-700 dark:text-purple-400">
                액션 아이템
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-purple-600 dark:text-purple-300">
                <li>• 고성과 캠페인 예산 증액 검토</li>
                <li>• 리타겟팅 캠페인으로 참여단계 이탈 감소</li>
                <li>• 전환 이벤트 추가 설정 (브로셔 다운로드 등)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

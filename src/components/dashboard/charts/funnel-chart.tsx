"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ArrowDown, Users, MousePointerClick, Eye, Target } from "lucide-react"
import type { FunnelStep } from "@/types/analytics"

interface FunnelChartProps {
  steps?: FunnelStep[]
  funnel?: {
    acquisition: number
    engagement: number
    interest: number
    conversion: number
  }
  loading?: boolean
  className?: string
}

// 단계별 아이콘
function getStepIcon(stepName: string) {
  switch (stepName) {
    case "유입":
      return Users
    case "참여":
      return MousePointerClick
    case "관심":
      return Eye
    case "전환":
      return Target
    default:
      return Users
  }
}

// 단계별 색상
function getStepColor(step: number): { bg: string; text: string; bar: string } {
  switch (step) {
    case 1:
      return { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" }
    case 2:
      return { bg: "bg-green-50", text: "text-green-600", bar: "bg-green-500" }
    case 3:
      return { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" }
    case 4:
      return { bg: "bg-purple-50", text: "text-purple-600", bar: "bg-purple-500" }
    default:
      return { bg: "bg-gray-50", text: "text-gray-600", bar: "bg-gray-500" }
  }
}

// 숫자 포맷
function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`
  }
  return num.toLocaleString()
}

export function FunnelChart({
  steps,
  funnel,
  loading = false,
  className,
}: FunnelChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-16 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 기본 퍼널 데이터 생성 (steps가 없는 경우)
  const displaySteps: FunnelStep[] = steps || (funnel ? [
    { step: 1, name: "유입", users: funnel.acquisition, rate: 100 },
    {
      step: 2,
      name: "참여",
      users: funnel.engagement,
      rate: funnel.acquisition > 0 ? (funnel.engagement / funnel.acquisition) * 100 : 0,
      dropoff: funnel.acquisition > 0 ? ((funnel.acquisition - funnel.engagement) / funnel.acquisition) * 100 : 0,
    },
    {
      step: 3,
      name: "관심",
      users: funnel.interest,
      rate: funnel.acquisition > 0 ? (funnel.interest / funnel.acquisition) * 100 : 0,
      dropoff: funnel.engagement > 0 ? ((funnel.engagement - funnel.interest) / funnel.engagement) * 100 : 0,
    },
    {
      step: 4,
      name: "전환",
      users: funnel.conversion,
      rate: funnel.acquisition > 0 ? (funnel.conversion / funnel.acquisition) * 100 : 0,
      dropoff: funnel.interest > 0 ? ((funnel.interest - funnel.conversion) / funnel.interest) * 100 : 0,
    },
  ] : [])

  if (displaySteps.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>마케팅 퍼널</CardTitle>
          <CardDescription>유입부터 전환까지의 사용자 여정</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            퍼널 데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxUsers = displaySteps[0]?.users || 0
  const finalConversion = displaySteps[displaySteps.length - 1]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>마케팅 퍼널</CardTitle>
        <CardDescription>
          전체 전환율: {finalConversion?.rate.toFixed(1)}% |
          유입 {formatNumber(displaySteps[0]?.users || 0)} → 전환 {formatNumber(finalConversion?.users || 0)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displaySteps.map((step, index) => {
            const Icon = getStepIcon(step.name)
            const colors = getStepColor(step.step)
            const barWidth = maxUsers > 0 ? (step.users / maxUsers) * 100 : 0
            const isLast = index === displaySteps.length - 1

            return (
              <div key={step.step}>
                {/* 퍼널 단계 */}
                <div className="relative">
                  <div
                    className={cn(
                      "relative flex items-center gap-4 p-4 rounded-lg transition-all",
                      colors.bg
                    )}
                    style={{
                      width: `${Math.max(barWidth, 30)}%`,
                      marginLeft: `${(100 - Math.max(barWidth, 30)) / 2}%`,
                    }}
                  >
                    {/* 아이콘 */}
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm",
                      colors.text
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-semibold", colors.text)}>
                          {step.step}. {step.name}
                        </span>
                        <span className="font-bold text-lg">
                          {formatNumber(step.users)}명
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          전체의 {step.rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 이탈률 표시 (마지막 단계 제외) */}
                {!isLast && step.dropoff !== undefined && (
                  <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowDown className="h-4 w-4" />
                      <span>
                        이탈 {step.dropoff.toFixed(1)}%
                        <span className="ml-1 text-xs">
                          (-{formatNumber(step.users - (displaySteps[index + 1]?.users || 0))}명)
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 요약 인사이트 */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-muted">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">퍼널 인사이트</p>
              <p className="text-sm text-muted-foreground mt-1">
                {displaySteps[0]?.users > 0 ? (
                  <>
                    총 {formatNumber(displaySteps[0].users)}명 방문 중{" "}
                    <span className="font-medium text-primary">{formatNumber(finalConversion?.users || 0)}명</span>이
                    전환에 성공했습니다.
                    {displaySteps[1]?.dropoff && displaySteps[1].dropoff > 40 && (
                      <span className="block mt-1">
                        💡 참여 단계에서 이탈률이 높습니다. 랜딩 페이지 개선을 권장합니다.
                      </span>
                    )}
                  </>
                ) : (
                  "데이터가 충분하지 않습니다."
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

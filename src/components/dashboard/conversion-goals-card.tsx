"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  FileText,
  Phone,
  MessageCircle,
  Briefcase,
  Mail,
  Target,
  TrendingUp,
} from "lucide-react"
import type { ConversionGoal, ConversionByChannel } from "@/types/analytics"

interface ConversionGoalsCardProps {
  goals?: ConversionGoal[]
  byChannel?: ConversionByChannel[]
  loading?: boolean
  className?: string
}

// 목표별 아이콘 매핑
function getGoalIcon(goalName: string) {
  switch (goalName) {
    case "form_submit_contact":
      return FileText
    case "click_phone":
      return Phone
    case "click_kakao":
      return MessageCircle
    case "view_portfolio":
      return Briefcase
    case "newsletter_signup":
      return Mail
    default:
      return Target
  }
}

// 금액 포맷
function formatCurrency(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1)}천만원`
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}만원`
  }
  return `${value.toLocaleString()}원`
}

// 채널 한글명
function getChannelLabel(channel: string): string {
  const mapping: Record<string, string> = {
    organic: "자연 검색",
    direct: "직접 유입",
    paid: "유료 검색",
    social: "소셜 미디어",
    referral: "추천 유입",
    email: "이메일",
    display: "디스플레이",
    paid_social: "유료 소셜",
  }
  return mapping[channel] || channel
}

// 채널 색상
function getChannelColor(channel: string): string {
  const mapping: Record<string, string> = {
    organic: "bg-green-500",
    direct: "bg-blue-500",
    paid: "bg-purple-500",
    social: "bg-pink-500",
    referral: "bg-amber-500",
    email: "bg-cyan-500",
    display: "bg-orange-500",
    paid_social: "bg-rose-500",
  }
  return mapping[channel] || "bg-gray-500"
}

export function ConversionGoalsCard({
  goals,
  byChannel,
  loading = false,
  className,
}: ConversionGoalsCardProps) {
  if (loading) {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2", className)}>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalConversions = goals?.reduce((sum, g) => sum + g.conversions, 0) || 0
  const totalValue = goals?.reduce((sum, g) => sum + g.conversion_value, 0) || 0

  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {/* 전환 목표별 성과 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            전환 목표
          </CardTitle>
          <CardDescription>
            총 {totalConversions.toLocaleString()}건 | 전환 가치 {formatCurrency(totalValue)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goals && goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => {
                const Icon = getGoalIcon(goal.goal_name)
                const percentage = totalConversions > 0
                  ? (goal.conversions / totalConversions) * 100
                  : 0

                return (
                  <div
                    key={goal.goal_name}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{goal.goal_label}</span>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {goal.conversions.toLocaleString()}건
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 w-16 text-right">
                          {formatCurrency(goal.conversion_value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span>전환율: {goal.cvr.toFixed(2)}%</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              전환 목표 데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* 채널별 전환 성과 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            채널별 전환
          </CardTitle>
          <CardDescription>
            유입 채널별 전환 성과 비교
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byChannel && byChannel.length > 0 ? (
            <div className="space-y-3">
              {byChannel.map((channel) => {
                const maxConversions = Math.max(...byChannel.map(c => c.conversions))
                const barWidth = maxConversions > 0
                  ? (channel.conversions / maxConversions) * 100
                  : 0

                return (
                  <div
                    key={channel.channel}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <div className={cn("w-3 h-3 rounded-full flex-shrink-0", getChannelColor(channel.channel))} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium truncate">
                          {getChannelLabel(channel.channel)}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold">
                            {channel.conversions.toLocaleString()}
                          </span>
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded",
                              channel.cvr >= 3 ? "bg-green-100 text-green-700" :
                              channel.cvr >= 2 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-600"
                            )}
                          >
                            {channel.cvr.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", getChannelColor(channel.channel))}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 text-right">
                        {formatCurrency(channel.value)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              채널별 전환 데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

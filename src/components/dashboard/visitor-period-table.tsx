"use client"

import { useState, Fragment, useRef } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Users,
  Eye,
  Clock,
} from "lucide-react"
import type {
  DailyVisitorData,
  WeeklyVisitorData,
  MonthlyVisitorData,
  VisitorSummary,
  ViewMode,
} from "@/types/analytics"

interface VisitorPeriodTableProps {
  daily: DailyVisitorData[]
  weekly: WeeklyVisitorData[]
  monthly: MonthlyVisitorData[]
  summary?: VisitorSummary
  loading?: boolean
}

// 숫자 포맷 함수
function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR")
}

// 시간 포맷 함수 (초 -> "m:ss")
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// 모바일 카드 컴포넌트
interface MobileCardProps {
  period: string
  subPeriod?: string
  visitors: number
  pageviews: number
  sessions: number
  bounceRate: number
  avgDuration: number
  change?: number
  isHighlighted?: boolean
}

function MobileDataCard({
  period,
  subPeriod,
  visitors,
  pageviews,
  sessions,
  bounceRate,
  avgDuration,
  change,
  isHighlighted,
}: MobileCardProps) {
  return (
    <div
      className={`flex-shrink-0 w-[85%] snap-center ${
        isHighlighted
          ? "bg-amber-50 border-amber-300"
          : "bg-white border-gray-200"
      } border rounded-xl p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className={`font-semibold ${
              isHighlighted ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {period}
          </p>
          {subPeriod && <p className="text-xs text-gray-500">{subPeriod}</p>}
        </div>
        {change !== undefined && change !== 0 && (
          <div
            className={`flex items-center text-xs px-2 py-1 rounded-full ${
              change > 0
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            방문자
          </p>
          <p className="font-medium">{formatNumber(visitors)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs flex items-center gap-1">
            <Eye className="h-3 w-3" />
            페이지뷰
          </p>
          <p className="font-medium">{formatNumber(pageviews)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            체류시간
          </p>
          <p className="font-medium">{formatDuration(avgDuration)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">이탈률</p>
          <p className="font-medium">{bounceRate.toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-gray-500 text-xs">세션수</p>
        <p
          className={`text-lg font-bold ${
            isHighlighted ? "text-amber-600" : "text-blue-600"
          }`}
        >
          {formatNumber(sessions)}
        </p>
      </div>
    </div>
  )
}

export function VisitorPeriodTable({
  daily,
  weekly,
  monthly,
  summary,
  loading,
}: VisitorPeriodTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [mobileCardIndex, setMobileCardIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
  }

  // 변화율 표시 컴포넌트
  const ChangeIndicator = ({ value }: { value?: number }) => {
    if (value === undefined || value === 0)
      return <span className="text-gray-400">-</span>
    const isPositive = value > 0
    return (
      <span
        className={`flex items-center justify-center text-xs ${
          isPositive ? "text-green-600" : "text-red-600"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3 mr-0.5" />
        ) : (
          <TrendingDown className="h-3 w-3 mr-0.5" />
        )}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  // 로딩 상태
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            누적 데이터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 모바일용 데이터 준비
  const getMobileCards = () => {
    const cards: MobileCardProps[] = []

    if (viewMode === "monthly") {
      monthly.forEach((m) => {
        cards.push({
          period: m.month_label,
          visitors: m.visitors,
          pageviews: m.pageviews,
          sessions: m.sessions,
          bounceRate: m.bounceRate,
          avgDuration: m.avgDuration,
          change: m.visitors_change,
        })
      })
    } else if (viewMode === "weekly") {
      weekly.forEach((w) => {
        cards.push({
          period: w.week_label,
          subPeriod: `${w.week_start} ~ ${w.week_end}`,
          visitors: w.visitors,
          pageviews: w.pageviews,
          sessions: w.sessions,
          bounceRate: w.bounceRate,
          avgDuration: w.avgDuration,
          change: w.visitors_change,
        })
      })
    } else {
      // 일별: 월별로 그룹화하여 표시
      const dailyByMonth = daily.reduce((acc, d) => {
        const month = d.date.substring(0, 7)
        if (!acc[month]) acc[month] = []
        acc[month].push(d)
        return acc
      }, {} as Record<string, DailyVisitorData[]>)

      Object.entries(dailyByMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([month, days]) => {
          const [year, m] = month.split("-")
          cards.push({
            period: `${year}년 ${parseInt(m)}월`,
            subPeriod: `${days.length}일`,
            visitors: days.reduce((sum, d) => sum + d.visitors, 0),
            pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
            sessions: days.reduce((sum, d) => sum + d.sessions, 0),
            bounceRate:
              days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length,
            avgDuration:
              days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length,
          })
        })
    }

    // 합계 카드 추가
    if (summary && cards.length > 0) {
      cards.unshift({
        period: "전체 합계",
        subPeriod: `${summary.date_range.start} ~ ${summary.date_range.end}`,
        visitors: summary.total_visitors,
        pageviews: summary.total_pageviews,
        sessions: summary.total_sessions,
        bounceRate: summary.avg_bounce_rate,
        avgDuration: summary.avg_session_duration,
        isHighlighted: true,
      })
    }

    return cards
  }

  const mobileCards = getMobileCards()

  // 스크롤 핸들러
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / mobileCards.length
      const newIndex = Math.round(container.scrollLeft / cardWidth)
      setMobileCardIndex(newIndex)
    }
  }

  // 네비게이션 버튼 핸들러
  const scrollToCard = (index: number) => {
    if (scrollContainerRef.current && mobileCards.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / mobileCards.length
      container.scrollTo({ left: cardWidth * index, behavior: "smooth" })
      setMobileCardIndex(index)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg whitespace-nowrap">
            <BarChart3 className="h-5 w-5 flex-shrink-0" />
            <span>누적 데이터</span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "daily" ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setViewMode("daily")
                setMobileCardIndex(0)
              }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              일간
            </Button>
            <Button
              variant={viewMode === "weekly" ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setViewMode("weekly")
                setMobileCardIndex(0)
              }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              주간
            </Button>
            <Button
              variant={viewMode === "monthly" ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setViewMode("monthly")
                setMobileCardIndex(0)
              }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              월간
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 모바일: 스와이프 카드 캐러셀 */}
        <div className="md:hidden">
          {mobileCards.length > 0 ? (
            <>
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-2 px-2"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {mobileCards.map((card, index) => (
                  <MobileDataCard key={index} {...card} />
                ))}
              </div>

              {/* 네비게이션 컨트롤 */}
              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={() => scrollToCard(Math.max(0, mobileCardIndex - 1))}
                  disabled={mobileCardIndex === 0}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>

                <div className="flex gap-1.5">
                  {mobileCards.slice(0, Math.min(mobileCards.length, 10)).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === mobileCardIndex
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    />
                  ))}
                  {mobileCards.length > 10 && (
                    <span className="text-xs text-gray-400 ml-1">
                      +{mobileCards.length - 10}
                    </span>
                  )}
                </div>

                <button
                  onClick={() =>
                    scrollToCard(
                      Math.min(mobileCards.length - 1, mobileCardIndex + 1)
                    )
                  }
                  disabled={mobileCardIndex === mobileCards.length - 1}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-2">
                {mobileCardIndex + 1} / {mobileCards.length}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 데스크톱: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  기간
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  방문자
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  페이지뷰
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  세션
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  체류시간
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  이탈률
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  변화
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* 월별 뷰 */}
              {viewMode === "monthly" &&
                monthly.map((m) => (
                  <Fragment key={m.month}>
                    <tr
                      className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                      onClick={() => toggleMonth(m.month)}
                    >
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          {expandedMonths.has(m.month) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <Calendar className="h-4 w-4 text-blue-600" />
                          {m.month_label}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatNumber(m.visitors)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatNumber(m.pageviews)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatNumber(m.sessions)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatDuration(m.avgDuration)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {m.bounceRate.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ChangeIndicator value={m.visitors_change} />
                      </td>
                    </tr>
                    {/* 월 내 주별 데이터 */}
                    {expandedMonths.has(m.month) &&
                      m.weeks?.map((w) => (
                        <tr
                          key={`${m.month}-${w.week_label}`}
                          className="bg-gray-50 hover:bg-gray-100"
                        >
                          <td className="px-3 py-2 pl-10">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">
                                {w.week_label}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({w.week_start} ~ {w.week_end})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(w.visitors)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(w.pageviews)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumber(w.sessions)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatDuration(w.avgDuration)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {w.bounceRate.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            <ChangeIndicator value={w.visitors_change} />
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}

              {/* 주별 뷰 */}
              {viewMode === "weekly" &&
                weekly.map((w) => (
                  <tr key={w.week_label} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div>
                        <span className="font-medium">{w.week_label}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          ({w.week_start} ~ {w.week_end})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(w.visitors)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(w.pageviews)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(w.sessions)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatDuration(w.avgDuration)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {w.bounceRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ChangeIndicator value={w.visitors_change} />
                    </td>
                  </tr>
                ))}

              {/* 일별 뷰 - 월별로 그룹화 */}
              {viewMode === "daily" &&
                (() => {
                  const dailyByMonth = daily.reduce((acc, d) => {
                    const month = d.date.substring(0, 7)
                    if (!acc[month]) acc[month] = []
                    acc[month].push(d)
                    return acc
                  }, {} as Record<string, DailyVisitorData[]>)

                  const monthSummaries = Object.entries(dailyByMonth)
                    .map(([month, days]) => {
                      const [year, m] = month.split("-")
                      return {
                        month,
                        month_label: `${year}년 ${parseInt(m)}월`,
                        days,
                        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
                        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
                        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
                        bounceRate:
                          days.reduce((sum, d) => sum + d.bounceRate, 0) /
                          days.length,
                        avgDuration:
                          days.reduce((sum, d) => sum + d.avgDuration, 0) /
                          days.length,
                      }
                    })
                    .sort((a, b) => b.month.localeCompare(a.month))

                  return monthSummaries.map((ms) => (
                    <Fragment key={ms.month}>
                      <tr
                        className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                        onClick={() => toggleMonth(ms.month)}
                      >
                        <td className="px-3 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            {expandedMonths.has(ms.month) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <Calendar className="h-4 w-4 text-blue-600" />
                            {ms.month_label}
                            <span className="text-xs text-gray-400 ml-1">
                              ({ms.days.length}일)
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatNumber(ms.visitors)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatNumber(ms.pageviews)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatNumber(ms.sessions)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatDuration(ms.avgDuration)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {ms.bounceRate.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2"></td>
                      </tr>
                      {expandedMonths.has(ms.month) &&
                        [...ms.days]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((d) => (
                            <tr key={d.date} className="hover:bg-gray-50">
                              <td className="px-3 py-1 pl-10 text-gray-500 text-sm">
                                {d.date}
                              </td>
                              <td className="px-3 py-1 text-right text-sm">
                                {formatNumber(d.visitors)}
                              </td>
                              <td className="px-3 py-1 text-right text-sm">
                                {formatNumber(d.pageviews)}
                              </td>
                              <td className="px-3 py-1 text-right text-sm">
                                {formatNumber(d.sessions)}
                              </td>
                              <td className="px-3 py-1 text-right text-sm">
                                {formatDuration(d.avgDuration)}
                              </td>
                              <td className="px-3 py-1 text-right text-sm">
                                {d.bounceRate.toFixed(1)}%
                              </td>
                              <td className="px-3 py-1"></td>
                            </tr>
                          ))}
                    </Fragment>
                  ))
                })()}

              {/* 전체 합계 행 */}
              {summary && daily.length > 0 && (
                <tr className="bg-amber-50 font-semibold border-t-2 border-amber-300">
                  <td className="px-3 py-3 font-bold text-amber-600">
                    전체 합계
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      ({summary.date_range.start} ~ {summary.date_range.end})
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatNumber(summary.total_visitors)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatNumber(summary.total_pageviews)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatNumber(summary.total_sessions)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatDuration(summary.avg_session_duration)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {summary.avg_bounce_rate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3"></td>
                </tr>
              )}

              {/* 데이터 없음 */}
              {((viewMode === "monthly" && monthly.length === 0) ||
                (viewMode === "weekly" && weekly.length === 0) ||
                (viewMode === "daily" && daily.length === 0)) && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

import { NextRequest, NextResponse } from "next/server"
import {
  getDailyAnalyticsFromCache,
  getTopPagesFromCache,
  getDeviceStatsFromCache,
  getCountryStatsFromCache,
  getHourlyTrafficFromCache,
} from "@/lib/airtable-cache"

// 빈 데이터
const EMPTY_DATA = {
  overview: {
    totalVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    avgSessionDuration: "0분 0초",
    bounceRate: 0,
    newVisitors: 0,
    returningVisitors: 0,
    changes: {
      visitors: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    },
  },
  daily: [],
  countries: [],
  pages: [],
  devices: [],
  browsers: [],
  hourlyTraffic: [],
}

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터에서 days 추출 (기본값 7일)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "7", 10)

    // Airtable 캐시에서 데이터 조회
    const [dailyData, topPages, deviceStats, countryStats, hourlyTraffic] = await Promise.all([
      getDailyAnalyticsFromCache(days * 2), // 비교를 위해 2배 기간
      getTopPagesFromCache(),
      getDeviceStatsFromCache(),
      getCountryStatsFromCache(),
      getHourlyTrafficFromCache(),
    ])

    if (dailyData.length === 0) {
      return NextResponse.json(EMPTY_DATA)
    }

    // 현재 기간과 이전 기간 분리
    const currentPeriod = dailyData.slice(0, days)
    const previousPeriod = dailyData.slice(days, days * 2)

    // Overview 계산
    const totalVisitors = currentPeriod.reduce((sum, d) => sum + d.visitors, 0)
    const pageViews = currentPeriod.reduce((sum, d) => sum + d.pageviews, 0)
    const newVisitors = currentPeriod.reduce((sum, d) => sum + d.newUsers, 0)
    const bounceRate = currentPeriod.length > 0
      ? currentPeriod.reduce((sum, d) => sum + d.bounceRate, 0) / currentPeriod.length
      : 0
    const avgDuration = currentPeriod.length > 0
      ? currentPeriod.reduce((sum, d) => sum + d.avgDuration, 0) / currentPeriod.length
      : 0

    // 이전 기간 데이터
    const prevVisitors = previousPeriod.reduce((sum, d) => sum + d.visitors, 0)
    const prevPageViews = previousPeriod.reduce((sum, d) => sum + d.pageviews, 0)
    const prevBounceRate = previousPeriod.length > 0
      ? previousPeriod.reduce((sum, d) => sum + d.bounceRate, 0) / previousPeriod.length
      : 0
    const prevAvgDuration = previousPeriod.length > 0
      ? previousPeriod.reduce((sum, d) => sum + d.avgDuration, 0) / previousPeriod.length
      : 0

    // 변화율 계산
    const calcChange = (curr: number, prev: number) =>
      prev === 0 ? 0 : ((curr - prev) / prev) * 100

    // 시간 포맷
    const mins = Math.floor(avgDuration / 60)
    const secs = Math.floor(avgDuration % 60)
    const avgSessionDuration = `${mins}분 ${secs}초`

    // 일별 데이터 (MM/DD 형식)
    const daily = currentPeriod.map(d => ({
      date: d.date.slice(5).replace("-", "/"),
      visitors: d.visitors,
      pageviews: d.pageviews,
      sessions: d.sessions,
    })).reverse()

    // 페이지별 데이터
    const pages = topPages.map(p => ({
      path: p.path,
      title: p.title,
      views: p.views,
      uniqueViews: p.uniqueViews,
      avgTime: p.avgTime,
      bounceRate: p.bounceRate,
    }))

    // 기기별 데이터
    const devices = deviceStats.map(d => ({
      device: d.device,
      visitors: d.visitors,
      percentage: d.percentage,
    }))

    // 지역별 데이터
    const countries = countryStats.map(c => ({
      country: c.country,
      visitors: c.visitors,
      percentage: c.percentage,
    }))

    // 시간대별 데이터
    const hourly = hourlyTraffic.map(h => ({
      hour: h.hour,
      visitors: h.visitors,
    }))

    return NextResponse.json({
      overview: {
        totalVisitors,
        uniqueVisitors: totalVisitors,
        pageViews,
        avgSessionDuration,
        bounceRate,
        newVisitors,
        returningVisitors: totalVisitors - newVisitors,
        changes: {
          visitors: calcChange(totalVisitors, prevVisitors),
          pageViews: calcChange(pageViews, prevPageViews),
          bounceRate: calcChange(bounceRate, prevBounceRate),
          avgSessionDuration: calcChange(avgDuration, prevAvgDuration),
        },
      },
      daily,
      countries,
      pages,
      devices,
      browsers: [], // 브라우저별 데이터는 아직 미구현
      hourlyTraffic: hourly,
    })
  } catch (error) {
    console.error("Visitors API Error:", error)
    return NextResponse.json(EMPTY_DATA)
  }
}

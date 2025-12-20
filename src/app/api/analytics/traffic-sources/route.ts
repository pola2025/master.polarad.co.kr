import { NextRequest, NextResponse } from "next/server"
import { getTrafficSourcesDetailData } from "@/lib/google-analytics"
import type { TrafficSourcesData, TrafficChannel, TrafficSource, TopReferrer } from "@/types/analytics"

// 데모 데이터 생성 함수
function generateDemoTrafficData(): TrafficSourcesData {
  const channels: TrafficChannel[] = [
    {
      channel: "organic",
      visitors: 4850,
      sessions: 5420,
      percentage: 42.5,
      bounceRate: 35.2,
      avgDuration: 245,
      conversions: 108,
      cvr: 2.0,
    },
    {
      channel: "direct",
      visitors: 3210,
      sessions: 3650,
      percentage: 28.2,
      bounceRate: 42.1,
      avgDuration: 180,
      conversions: 96,
      cvr: 2.6,
    },
    {
      channel: "social",
      visitors: 1890,
      sessions: 2100,
      percentage: 16.6,
      bounceRate: 48.5,
      avgDuration: 120,
      conversions: 38,
      cvr: 1.8,
    },
    {
      channel: "referral",
      visitors: 980,
      sessions: 1120,
      percentage: 8.6,
      bounceRate: 38.9,
      avgDuration: 195,
      conversions: 22,
      cvr: 2.0,
    },
    {
      channel: "paid",
      visitors: 470,
      sessions: 520,
      percentage: 4.1,
      bounceRate: 32.4,
      avgDuration: 210,
      conversions: 18,
      cvr: 3.5,
    },
  ]

  const sources: TrafficSource[] = [
    { source: "google", medium: "organic", visitors: 3890, sessions: 4350, bounceRate: 34.5, avgDuration: 255 },
    { source: "(direct)", medium: "(none)", visitors: 3210, sessions: 3650, bounceRate: 42.1, avgDuration: 180 },
    { source: "naver", medium: "organic", visitors: 680, sessions: 780, bounceRate: 38.2, avgDuration: 220 },
    { source: "instagram", medium: "social", visitors: 890, sessions: 980, bounceRate: 52.3, avgDuration: 95 },
    { source: "facebook", medium: "social", visitors: 620, sessions: 710, bounceRate: 45.8, avgDuration: 135 },
    { source: "google", medium: "cpc", visitors: 470, sessions: 520, bounceRate: 32.4, avgDuration: 210 },
    { source: "daum", medium: "organic", visitors: 280, sessions: 310, bounceRate: 39.5, avgDuration: 190 },
    { source: "twitter", medium: "social", visitors: 180, sessions: 210, bounceRate: 55.2, avgDuration: 85 },
    { source: "blog.naver.com", medium: "referral", visitors: 420, sessions: 480, bounceRate: 36.8, avgDuration: 205 },
    { source: "brunch.co.kr", medium: "referral", visitors: 280, sessions: 320, bounceRate: 40.2, avgDuration: 185 },
  ]

  const topReferrers: TopReferrer[] = [
    { referrer: "blog.naver.com/marketing_tips", visitors: 245, landingPage: "/blog/tiktok-guide" },
    { referrer: "brunch.co.kr/@marketinglab", visitors: 180, landingPage: "/service" },
    { referrer: "cafe.naver.com/marketers", visitors: 156, landingPage: "/" },
    { referrer: "tistory.com/marketing-blog", visitors: 120, landingPage: "/portfolio" },
    { referrer: "medium.com/@growth-hacker", visitors: 89, landingPage: "/blog/sns-strategy" },
    { referrer: "youtube.com", visitors: 78, landingPage: "/" },
    { referrer: "linkedin.com", visitors: 65, landingPage: "/contact" },
    { referrer: "github.com", visitors: 47, landingPage: "/blog/tech-marketing" },
  ]

  return { channels, sources, topReferrers }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "30")

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      const demoData = generateDemoTrafficData()
      return NextResponse.json({ ...demoData, isDemoData: true })
    }

    // 실제 GA4 데이터 조회
    const data = await getTrafficSourcesDetailData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Traffic Sources API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch traffic sources data" },
      { status: 500 }
    )
  }
}

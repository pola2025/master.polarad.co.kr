import { NextRequest, NextResponse } from "next/server"
import { getCampaignPerformanceData } from "@/lib/google-analytics"

// 더미 데이터 (개발/테스트용)
const DEMO_DATA = {
  campaigns: [
    {
      campaign: "2024_winter_sale",
      source: "google",
      medium: "cpc",
      visitors: 2340,
      sessions: 2890,
      conversions: 45,
      cvr: 1.56,
      bounceRate: 35.2,
      avgDuration: 245,
    },
    {
      campaign: "brand_awareness_q4",
      source: "facebook",
      medium: "cpm",
      visitors: 1890,
      sessions: 2150,
      conversions: 28,
      cvr: 1.30,
      bounceRate: 42.1,
      avgDuration: 198,
    },
    {
      campaign: "newsletter_dec",
      source: "email",
      medium: "email",
      visitors: 856,
      sessions: 912,
      conversions: 34,
      cvr: 3.73,
      bounceRate: 28.5,
      avgDuration: 312,
    },
    {
      campaign: "insta_reels_promo",
      source: "instagram",
      medium: "social",
      visitors: 1245,
      sessions: 1380,
      conversions: 18,
      cvr: 1.30,
      bounceRate: 48.3,
      avgDuration: 156,
    },
    {
      campaign: "naver_keyword_ad",
      source: "naver",
      medium: "cpc",
      visitors: 1560,
      sessions: 1820,
      conversions: 52,
      cvr: 2.86,
      bounceRate: 32.1,
      avgDuration: 278,
    },
  ],
  summary: {
    total_campaigns: 5,
    total_visitors: 7891,
    total_conversions: 177,
    avg_cvr: 1.95,
  },
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start_date") || undefined
    const endDate = searchParams.get("end_date") || undefined
    const campaign = searchParams.get("campaign") || undefined

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({
        ...DEMO_DATA,
        isDemoData: true,
      })
    }

    const data = await getCampaignPerformanceData(startDate, endDate, campaign)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Campaigns API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch campaign data" },
      { status: 500 }
    )
  }
}

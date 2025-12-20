import { NextRequest, NextResponse } from "next/server"
import { getCampaignPerformanceData } from "@/lib/google-analytics"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start_date") || undefined
    const endDate = searchParams.get("end_date") || undefined
    const campaign = searchParams.get("campaign") || undefined

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "API not configured", message: "데이터 수집 준비 중입니다." },
        { status: 501 }
      )
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

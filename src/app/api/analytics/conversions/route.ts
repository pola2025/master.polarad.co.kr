import { NextRequest, NextResponse } from "next/server"
import { getConversionAnalyticsData, getFunnelData } from "@/lib/google-analytics"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start_date") || undefined
    const endDate = searchParams.get("end_date") || undefined
    const includeFunnel = searchParams.get("funnel") === "true"

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "API not configured", message: "데이터 수집 준비 중입니다." },
        { status: 501 }
      )
    }

    const data = await getConversionAnalyticsData(startDate, endDate)

    // 퍼널 상세 데이터 추가 요청 시
    if (includeFunnel) {
      const funnelData = await getFunnelData(startDate, endDate)
      return NextResponse.json({
        ...data,
        steps: funnelData.steps,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Conversions API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversion data" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getTrafficSourcesDetailData } from "@/lib/google-analytics"

export async function GET(request: NextRequest) {
  try {
    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      )
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

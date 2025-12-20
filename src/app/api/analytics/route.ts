import { NextResponse } from "next/server"
import { getDashboardData } from "@/lib/google-analytics"

export async function GET() {
  try {
    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      )
    }

    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    )
  }
}

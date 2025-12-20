import { NextRequest, NextResponse } from "next/server"
import { getConversionAnalyticsData, getFunnelData } from "@/lib/google-analytics"

// 더미 데이터 (개발/테스트용)
const DEMO_DATA = {
  goals: [
    {
      goal_name: "form_submit_contact",
      goal_label: "문의 폼 제출",
      conversions: 145,
      conversion_value: 7250000,
      cvr: 1.16,
    },
    {
      goal_name: "click_phone",
      goal_label: "전화 클릭",
      conversions: 89,
      conversion_value: 2670000,
      cvr: 0.71,
    },
    {
      goal_name: "click_kakao",
      goal_label: "카카오톡 상담",
      conversions: 67,
      conversion_value: 1340000,
      cvr: 0.54,
    },
    {
      goal_name: "view_portfolio",
      goal_label: "포트폴리오 조회",
      conversions: 423,
      conversion_value: 2115000,
      cvr: 3.38,
    },
    {
      goal_name: "newsletter_signup",
      goal_label: "뉴스레터 구독",
      conversions: 56,
      conversion_value: 560000,
      cvr: 0.45,
    },
  ],
  by_channel: [
    { channel: "organic", conversions: 108, cvr: 2.0, value: 5400000 },
    { channel: "direct", conversions: 96, cvr: 3.0, value: 4800000 },
    { channel: "paid", conversions: 63, cvr: 3.0, value: 3150000 },
    { channel: "social", conversions: 40, cvr: 1.8, value: 2000000 },
    { channel: "referral", conversions: 28, cvr: 2.1, value: 1400000 },
    { channel: "email", conversions: 45, cvr: 4.5, value: 2250000 },
  ],
  funnel: {
    acquisition: 12500,
    engagement: 7687,
    interest: 4212,
    conversion: 1145,
  },
}

const DEMO_FUNNEL_STEPS = [
  { step: 1, name: "유입", users: 12500, rate: 100 },
  { step: 2, name: "참여", users: 7687, rate: 61.5, dropoff: 38.5 },
  { step: 3, name: "관심", users: 4212, rate: 33.7, dropoff: 45.2 },
  { step: 4, name: "전환", users: 1145, rate: 9.2, dropoff: 72.8 },
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start_date") || undefined
    const endDate = searchParams.get("end_date") || undefined
    const includeFunnel = searchParams.get("funnel") === "true"

    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({
        ...DEMO_DATA,
        steps: includeFunnel ? DEMO_FUNNEL_STEPS : undefined,
        isDemoData: true,
      })
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

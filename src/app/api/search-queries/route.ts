import { NextResponse } from "next/server"
import { getSearchQueries } from "@/lib/search-console"

export async function GET() {
  try {
    // 환경 변수 확인
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      // 개발 환경에서는 더미 데이터 반환
      return NextResponse.json({
        queries: [
          { query: "온라인 마케팅", clicks: 45, impressions: 890, ctr: 5.1, position: 8.2 },
          { query: "법인 영업", clicks: 38, impressions: 720, ctr: 5.3, position: 6.5 },
          { query: "DB 마케팅", clicks: 32, impressions: 580, ctr: 5.5, position: 7.8 },
          { query: "리드 제너레이션", clicks: 28, impressions: 450, ctr: 6.2, position: 5.3 },
          { query: "메타 광고 대행", clicks: 25, impressions: 410, ctr: 6.1, position: 9.1 },
          { query: "페이스북 광고", clicks: 22, impressions: 380, ctr: 5.8, position: 11.2 },
          { query: "인스타그램 마케팅", clicks: 18, impressions: 350, ctr: 5.1, position: 12.5 },
          { query: "중소기업 마케팅", clicks: 15, impressions: 290, ctr: 5.2, position: 14.3 },
          { query: "홈페이지 제작", clicks: 12, impressions: 250, ctr: 4.8, position: 18.7 },
          { query: "B2B 영업", clicks: 10, impressions: 180, ctr: 5.6, position: 15.9 },
        ],
        totalClicks: 245,
        totalImpressions: 4500,
        avgCtr: 5.4,
        avgPosition: 10.9,
        isDemoData: true,
      })
    }

    const data = await getSearchQueries(7)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Search Console API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch search queries" },
      { status: 500 }
    )
  }
}

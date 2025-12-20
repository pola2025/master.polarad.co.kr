import { NextRequest, NextResponse } from "next/server"

// 비교 분석 API - 추후 구현 예정
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "Compare API not implemented yet" },
    { status: 501 }
  )
}

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("admin_session")

    return NextResponse.json({
      success: true,
      message: "로그아웃 성공",
    })
  } catch (error) {
    console.error("Logout Error:", error)
    return NextResponse.json(
      { error: "로그아웃 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

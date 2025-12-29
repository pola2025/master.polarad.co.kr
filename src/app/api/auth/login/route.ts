import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "서버 설정 오류: 관리자 비밀번호가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { error: "비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      )
    }

    // 세션 토큰 생성 (간단한 해시 방식)
    const sessionToken = Buffer.from(
      `admin:${Date.now()}:${Math.random().toString(36)}`
    ).toString("base64")

    // 쿠키 설정
    const cookieStore = await cookies()
    cookieStore.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    })

    return NextResponse.json({
      success: true,
      message: "로그인 성공",
    })
  } catch (error) {
    console.error("Login Error:", error)
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

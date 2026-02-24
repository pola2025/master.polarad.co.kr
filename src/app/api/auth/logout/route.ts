import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  const response = NextResponse.json(
    { success: true, message: "로그아웃 되었습니다" },
    { status: 200 },
  );

  if (token) {
    response.cookies.delete("admin_token");
  }

  return response;
}

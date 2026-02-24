import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateToken, checkRateLimit } from "@/lib/auth";
import { sendAdminOTP, verifyAdminOTP } from "@/lib/admin-otp";

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.",
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 },
      );
    }

    const { action, code } = await request.json();

    if (action === "send") {
      const result = await sendAdminOTP();
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "verify") {
      if (!code || typeof code !== "string") {
        return NextResponse.json(
          { error: "인증코드를 입력해주세요." },
          { status: 400 },
        );
      }

      const result = verifyAdminOTP(code.trim());
      if (!result.valid) {
        return NextResponse.json(
          { error: result.error, lockedUntil: result.lockedUntil },
          { status: 401 },
        );
      }

      const token = await generateToken();
      const cookieStore = await cookies();
      cookieStore.set("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

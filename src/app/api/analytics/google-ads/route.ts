import { NextRequest, NextResponse } from "next/server";
import { getGoogleAdsPerformanceData } from "@/lib/google-analytics";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("start_date") || undefined;
    const endDate = searchParams.get("end_date") || undefined;

    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY
    ) {
      return NextResponse.json(
        {
          error: "API not configured",
          message: "Google Analytics 인증이 설정되지 않았습니다.",
        },
        { status: 501 },
      );
    }

    const data = await getGoogleAdsPerformanceData(startDate, endDate);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Google Ads Analytics API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google Ads data" },
      { status: 500 },
    );
  }
}

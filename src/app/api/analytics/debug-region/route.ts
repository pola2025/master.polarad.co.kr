import { NextResponse } from "next/server";
import { getRegionData } from "@/lib/google-analytics";

export async function GET() {
  try {
    const data = await getRegionData(7);
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

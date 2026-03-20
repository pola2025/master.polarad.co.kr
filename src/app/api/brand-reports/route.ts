import { NextResponse } from "next/server";
import { listRecords, normalizeRecord } from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const records = await listRecords({
      maxRecords: 100,
      sortField: "createdTime",
      sortDirection: "desc",
    });
    const reports = records.map(normalizeRecord);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("브랜드 리포트 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

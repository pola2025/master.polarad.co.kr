import { NextRequest, NextResponse } from "next/server";
import {
  getRecord,
  updateRecord,
  deleteRecord,
  normalizeRecord,
  NotFoundError,
  FIELDS,
} from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }
    const record = await getRecord(id);
    return NextResponse.json({ report: normalizeRecord(record) });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }
    const { reportContent, summary, status } = await request.json();

    const ALLOWED_STATUSES = ["draft", "reviewed", "sent", "discarded"];
    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태" },
        { status: 400 },
      );
    }

    const fields: Record<string, string> = {};
    if (reportContent !== undefined)
      fields[FIELDS.reportContent] = reportContent;
    if (summary !== undefined) fields[FIELDS.summary] = summary;
    if (status !== undefined) fields[FIELDS.status] = status;

    await updateRecord(id, fields);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 업데이트 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

/**
 * Soft delete: sets status to "discarded".
 * Does NOT permanently remove the Airtable record.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }
    await deleteRecord(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 삭제 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

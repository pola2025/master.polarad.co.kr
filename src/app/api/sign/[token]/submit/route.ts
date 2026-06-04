import { NextRequest, NextResponse } from "next/server";
import { getContractByToken, submitSignedUpload } from "@/lib/contracts";
import { putChatFileToR2 } from "@/lib/r2-client";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

function clientIp(req: NextRequest): string {
  const h = req.headers;
  // Vercel이 직접 설정 → 스푸핑 불가. XFF는 후순위.
  const v =
    h.get("x-vercel-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for") ||
    "";
  return v.split(",")[0].trim();
}

async function validateFile(
  f: unknown,
  label: string,
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  if (!(f instanceof File) || f.size === 0)
    return { ok: false, error: `${label} 파일이 필요합니다` };
  if (f.size > MAX_BYTES)
    return { ok: false, error: `${label}는 10MB 이하만 가능합니다` };
  if (!ALLOWED.has(f.type))
    return { ok: false, error: `${label}는 PDF/JPG/PNG만 가능합니다` };
  return { ok: true, file: f };
}

/** POST /api/sign/[token]/submit — 광고주 동의 + 날인본 업로드(= 체결접수) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const c = await getContractByToken(token);
  if (!c) {
    return NextResponse.json({ error: "유효하지 않은 링크" }, { status: 404 });
  }
  if (c.status === "SUBMITTED" || c.status === "APPROVED") {
    return NextResponse.json(
      { error: "이미 제출된 계약입니다" },
      { status: 409 },
    );
  }
  if (c.status !== "SENT" && c.status !== "DRAFT") {
    return NextResponse.json({ error: "제출할 수 없는 상태" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const confirmed = form.get("confirm") === "true";
  const agreed = form.get("agree") === "true";
  if (!confirmed || !agreed) {
    return NextResponse.json(
      { error: "계약서 확인 및 동의 체크가 필요합니다" },
      { status: 400 },
    );
  }

  const name = String(form.get("name") || "")
    .trim()
    .slice(0, 100);
  if (!name) {
    return NextResponse.json(
      { error: "서명자 성명을 입력하세요" },
      { status: 400 },
    );
  }
  const title = String(form.get("title") || "")
    .trim()
    .slice(0, 100);

  // 필수: 법인인감 날인 계약서
  const v1 = await validateFile(form.get("contractFile"), "날인 계약서");
  if (!v1.ok) return NextResponse.json({ error: v1.error }, { status: 400 });

  // 선택: 법인인감증명서
  const certRaw = form.get("certFile");
  let certKey = "";

  const ip = clientIp(req);
  const ua = (req.headers.get("user-agent") || "").slice(0, 300);
  const ts = Date.now();

  try {
    const contractKey = `contracts/${c.id}/signed-${ts}.${EXT[v1.file.type]}`;
    await putChatFileToR2({
      key: contractKey,
      bytes: await v1.file.arrayBuffer(),
      contentType: v1.file.type,
      metadata: { contractId: c.id, kind: "signed-contract" },
    });

    if (certRaw instanceof File && certRaw.size > 0) {
      const v2 = await validateFile(certRaw, "법인인감증명서");
      if (!v2.ok)
        return NextResponse.json({ error: v2.error }, { status: 400 });
      certKey = `contracts/${c.id}/seal-cert-${ts}.${EXT[v2.file.type]}`;
      await putChatFileToR2({
        key: certKey,
        bytes: await v2.file.arrayBuffer(),
        contentType: v2.file.type,
        metadata: { contractId: c.id, kind: "seal-cert" },
      });
    }

    const r = await submitSignedUpload({
      token,
      consentName: name,
      consentTitle: title,
      uploadedContractKey: contractKey,
      uploadedSealCertKey: certKey,
      ip,
      ua,
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: "제출 처리 실패", reason: r.reason },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[master/sign-submit] 실패:", err);
    return NextResponse.json({ error: "업로드 처리 실패" }, { status: 500 });
  }
}

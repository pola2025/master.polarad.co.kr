"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  status: string;
  hasEmail: boolean;
  signLink: string;
}

export default function ContractActions({
  id,
  status,
  hasEmail,
  signLink,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function call(path: string, body?: object) {
    setMsg("");
    setBusy(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "실패");
      return data;
    } finally {
      setBusy("");
    }
  }

  const send = async () => {
    try {
      const d = await call(`/api/contracts/${id}/send`);
      setMsg(`✅ 서명 링크 발송 완료 (${d.messageId || "ok"})`);
      router.refresh();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "발송 실패"}`);
    }
  };

  const approve = async () => {
    if (
      !confirm(
        "이 계약을 최종 확정합니다. 광고주에게 확정 안내메일과 최종본이 자동 발송됩니다. 진행할까요?",
      )
    )
      return;
    try {
      const d = await call(`/api/contracts/${id}/approve`);
      setMsg(
        d.emailSent
          ? "✅ 계약확정 + 확정메일 발송됨"
          : `✅ 계약확정 (메일 실패: ${d.emailError || "?"})`,
      );
      router.refresh();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "확정 실패"}`);
    }
  };

  const reject = async () => {
    const reason = prompt("반려 사유를 입력하세요(선택):") || "";
    try {
      await call(`/api/contracts/${id}/reject`, { reason });
      setMsg("반려 처리됨");
      router.refresh();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "반려 실패"}`);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(signLink);
      setMsg("🔗 서명 링크 복사됨");
    } catch {
      setMsg(signLink);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/contracts/${id}/html`}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
        >
          📄 계약서 점검(HTML/PDF)
        </a>
        <button
          onClick={copyLink}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          🔗 서명 링크 복사
        </button>
        {["DRAFT", "SENT"].includes(status) && (
          <button
            onClick={send}
            disabled={!hasEmail || busy !== ""}
            title={hasEmail ? "" : "광고주 이메일이 필요합니다"}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:bg-gray-300"
          >
            {status === "SENT" ? "재발송" : "광고주에게 발송"}
          </button>
        )}
        {status === "SUBMITTED" && (
          <>
            <button
              onClick={approve}
              disabled={busy !== ""}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm"
            >
              ✅ 완료체크(계약확정)
            </button>
            <button
              onClick={reject}
              disabled={busy !== ""}
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm"
            >
              반려
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-sm text-gray-700 dark:text-gray-300">{msg}</p>}
    </div>
  );
}

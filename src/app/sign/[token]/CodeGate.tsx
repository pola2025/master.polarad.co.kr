"use client";

import { useState } from "react";

export default function CodeGate({
  token,
  emailHint,
}: {
  token: string;
  emailHint: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (code.length !== 6) return setError("6자리 인증번호를 입력하세요.");
    setBusy(true);
    try {
      const res = await fetch(`/api/sign/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "인증 실패");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "인증 실패");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-7 text-center">
        <p className="text-xs tracking-widest text-gray-400">
          POLARAD 전자계약
        </p>
        <h1 className="text-lg font-bold text-gray-900 mt-2">
          계약서 열람 인증
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          이메일(<b>{emailHint}</b>)로 받으신
          <br />
          <b>6자리 인증번호</b>를 입력해 주세요.
        </p>
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="000000"
          className="mt-5 w-full text-center text-2xl tracking-[0.4em] font-bold py-3 border border-gray-300 rounded-lg"
        />
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || code.length !== 6}
          className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300"
        >
          {busy ? "확인 중…" : "인증하고 계약서 열람"}
        </button>
        <p className="text-xs text-gray-400 mt-4">
          인증번호는 계약서 발송 메일에 포함되어 있습니다.
        </p>
      </div>
    </div>
  );
}

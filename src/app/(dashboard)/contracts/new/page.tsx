"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const won = (n: number) =>
  n > 0 ? new Intl.NumberFormat("ko-KR").format(n) + "원" : "-";

export default function NewContractPage() {
  const router = useRouter();
  const [f, setF] = useState({
    partyAName: "",
    partyACeo: "",
    partyABizno: "",
    partyACorpno: "",
    partyAAddr: "",
    partyAEmail: "",
    projectName: "",
    planLabel: "스탠다드 플랜",
    monthlyFee: 220000,
    periodMonths: 6,
    paymentMethod: "지정계좌이체 또는 온라인결제",
    specialTermsText: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | number) =>
    setF((p) => ({ ...p, [k]: v }));

  const total = (Number(f.monthlyFee) || 0) * (Number(f.periodMonths) || 0);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const specialTerms = f.specialTermsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, specialTerms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      router.push(`/contracts/${data.contract.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm";
  const label =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link
        href="/contracts"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← 목록으로
      </Link>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        새 계약
      </h1>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          광고주(갑) 정보
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>상호(법인명) *</label>
            <input
              className={input}
              value={f.partyAName}
              onChange={(e) => set("partyAName", e.target.value)}
              placeholder="주식회사 ○○"
            />
          </div>
          <div>
            <label className={label}>대표자 *</label>
            <input
              className={input}
              value={f.partyACeo}
              onChange={(e) => set("partyACeo", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>사업자등록번호 *</label>
            <input
              className={input}
              value={f.partyABizno}
              onChange={(e) => set("partyABizno", e.target.value)}
              placeholder="000-00-00000"
            />
          </div>
          <div>
            <label className={label}>법인등록번호</label>
            <input
              className={input}
              value={f.partyACorpno}
              onChange={(e) => set("partyACorpno", e.target.value)}
              placeholder="000000-0000000"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>소재지 *</label>
            <input
              className={input}
              value={f.partyAAddr}
              onChange={(e) => set("partyAAddr", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>광고주 이메일 (서명링크 수신)</label>
            <input
              className={input}
              type="email"
              value={f.partyAEmail}
              onChange={(e) => set("partyAEmail", e.target.value)}
              placeholder="advertiser@example.com"
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          계약 정보
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>대상 사업</label>
            <input
              className={input}
              value={f.projectName}
              onChange={(e) => set("projectName", e.target.value)}
              placeholder="예: 자수성가 사옥연구소"
            />
          </div>
          <div>
            <label className={label}>플랜명</label>
            <input
              className={input}
              value={f.planLabel}
              onChange={(e) => set("planLabel", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>월 금액(VAT 포함) *</label>
            <input
              className={input}
              type="number"
              value={f.monthlyFee}
              onChange={(e) => set("monthlyFee", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>계약 개월 *</label>
            <input
              className={input}
              type="number"
              value={f.periodMonths}
              onChange={(e) => set("periodMonths", Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm">
            선결제 청구금액: <b>{won(total)}</b>{" "}
            <span className="text-gray-500">
              (월 {won(Number(f.monthlyFee))} × {f.periodMonths}개월)
            </span>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>결제방식 (문서 표기)</label>
            <input
              className={input}
              value={f.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>특약사항 (한 줄에 하나씩)</label>
            <textarea
              className={input + " min-h-[90px]"}
              value={f.specialTermsText}
              onChange={(e) => set("specialTermsText", e.target.value)}
              placeholder={
                "예) 2건 동시 계약 조건으로 구글 추가매체 운영비 월 11만원 면제"
              }
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300"
      >
        {saving ? "생성 중…" : "계약 생성"}
      </button>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

interface PaymentInfo {
  bankName: string;
  account: string;
  holder: string;
  naverBooking: string;
}

interface Props {
  token: string;
  contractNumber: string;
  partyName: string;
  projectName: string;
  monthlyFee: number;
  periodMonths: number;
  totalFee: number;
  contractHtml: string;
  payment: PaymentInfo;
}

const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

export default function SignClient(props: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const printContract = () => {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  const canSubmit =
    confirm && agree && name.trim() && contractFile && !submitting;

  const submit = async () => {
    setError("");
    if (!confirm || !agree)
      return setError("계약서 확인 및 동의에 체크해 주세요.");
    if (!name.trim()) return setError("서명자 성명을 입력해 주세요.");
    if (!contractFile)
      return setError("법인인감 날인한 계약서 파일을 업로드해 주세요.");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("confirm", String(confirm));
      fd.set("agree", String(agree));
      fd.set("name", name.trim());
      fd.set("title", title.trim());
      fd.set("contractFile", contractFile);
      if (certFile) fd.set("certFile", certFile);

      const res = await fetch(`/api/sign/${props.token}/submit`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "제출 실패");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="max-w-md w-full rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-lg font-bold text-green-800">
            계약서가 제출되었습니다
          </h1>
          <p className="mt-2 text-sm text-green-700">
            계약번호 {props.contractNumber}
            <br />
            폴라애드 최종 확인 후 계약확정 안내 메일을 보내드립니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* 헤더 */}
        <header className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs tracking-widest text-gray-400">
            POLARAD 전자계약
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            온라인마케팅 대행 계약서
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {props.partyName}
            {props.projectName ? ` · ${props.projectName}` : ""} · 계약번호{" "}
            {props.contractNumber}
          </p>
        </header>

        {/* 계약서 본문 (A4) */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">1. 계약서 내용 확인</h2>
            <button
              onClick={printContract}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700"
            >
              📄 PDF 다운로드 / 인쇄
            </button>
          </div>
          <iframe
            ref={iframeRef}
            title="계약서"
            srcDoc={props.contractHtml}
            className="w-full bg-gray-50"
            style={{ height: "70vh", border: "none" }}
          />
          <p className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">
            법인 계약은 위 [PDF 다운로드]로 계약서를 내려받아{" "}
            <b>법인인감 날인</b> 후, 아래에서 파일을 업로드해 주세요.
          </p>
        </section>

        {/* 동의 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">2. 확인 및 동의</h2>
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5 w-5 h-5"
            />
            <span className="text-gray-800">계약서 내용을 확인하였습니다.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 w-5 h-5"
            />
            <span className="text-gray-800 font-medium">
              계약 내용에 동의합니다.
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="서명자 성명 *"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="직위 (예: 대표이사)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </section>

        {/* 업로드 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">3. 날인본 업로드</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              법인인감 날인 계약서 <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal">
                {" "}
                (PDF/JPG/PNG, 10MB)
              </span>
            </label>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setContractFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-gray-900 file:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              법인인감증명서{" "}
              <span className="text-gray-400 font-normal">(선택, 권장)</span>
            </label>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-gray-200 file:text-gray-800"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {submitting ? "제출 중…" : "계약서 제출 (체결 접수)"}
        </button>

        {/* 결제 안내 (문서엔 미포함, 여기서만) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-2">결제 안내</h2>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm space-y-3">
            <p className="text-gray-700">
              계약 금액 <b className="text-gray-900">{won(props.totalFee)}</b>{" "}
              <span className="text-gray-500">
                (월 {won(props.monthlyFee)} × {props.periodMonths}개월 · 선결제
                · VAT 포함)
              </span>
            </p>
            <div>
              <p className="font-medium text-gray-800">① 지정계좌이체</p>
              <p className="text-gray-700">
                {props.payment.bankName} {props.payment.account} (
                {props.payment.holder})
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-800">
                ② 온라인결제 (네이버예약)
              </p>
              <a
                href={props.payment.naverBooking}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1 px-4 py-2 rounded-lg bg-[#03c75a] text-white text-sm font-semibold"
              >
                네이버예약으로 결제하기
              </a>
              <p className="text-xs text-gray-500 mt-2">
                ※ 예약 날짜는 <b>오늘을 제외</b>한 날짜로 선택하시고, 계약
                금액에 맞는 옵션으로 결제를 진행해 주세요.
              </p>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400 pb-8">
          폴라애드 (POLARAD) · mkt@polarad.co.kr
        </p>
      </div>
    </div>
  );
}

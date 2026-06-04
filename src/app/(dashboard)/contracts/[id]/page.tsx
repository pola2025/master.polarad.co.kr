import Link from "next/link";
import { notFound } from "next/navigation";
import { getContract, parseSpecialTerms } from "@/lib/contracts";
import ContractActions from "./ContractActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";
const BASE = process.env.MASTER_URL || "https://master.polarad.co.kr";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 dark:border-gray-700/60 text-sm">
      <div className="w-32 shrink-0 text-gray-500">{k}</div>
      <div className="text-gray-900 dark:text-gray-100">{v || "-"}</div>
    </div>
  );
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContract(id);
  if (!c) notFound();

  const terms = parseSpecialTerms(c.special_terms);
  const signLink = `${BASE}/sign/${c.token}`;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link
        href="/contracts"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← 목록으로
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {c.contract_number}
          </h1>
          <p className="text-sm text-gray-500">
            {c.party_a_name}
            {c.project_name ? ` · ${c.project_name}` : ""} · 상태{" "}
            <b>{c.status}</b>
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <ContractActions
          id={c.id}
          status={c.status}
          hasEmail={Boolean(c.party_a_email)}
          signLink={signLink}
        />
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
          광고주(갑)
        </h2>
        <Row k="상호" v={c.party_a_name} />
        <Row k="대표자" v={c.party_a_ceo} />
        <Row k="사업자등록번호" v={c.party_a_bizno} />
        <Row k="법인등록번호" v={c.party_a_corpno} />
        <Row k="소재지" v={c.party_a_addr} />
        <Row k="이메일" v={c.party_a_email} />
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
          계약 내용
        </h2>
        <Row k="대상 사업" v={c.project_name} />
        <Row k="플랜" v={c.plan_label} />
        <Row k="월 금액" v={`${won(c.monthly_fee)} (VAT 포함)`} />
        <Row k="계약 기간" v={`${c.period_months}개월`} />
        <Row k="선결제 청구금액" v={<b>{won(c.total_fee)}</b>} />
        <Row k="결제방식" v={c.payment_method} />
        {terms.length > 0 && (
          <div className="pt-2 text-sm">
            <div className="text-gray-500 mb-1">특약사항</div>
            <ol className="list-decimal pl-5 space-y-1 text-gray-900 dark:text-gray-100">
              {terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
          진행 상태
        </h2>
        <Row
          k="수신확인"
          v={c.opened_at ? `📬 열람 (${c.opened_at})` : "미열람"}
        />
        <Row
          k="동의/서명"
          v={
            c.consent_agreed
              ? `${c.consent_name}${c.consent_title ? ` (${c.consent_title})` : ""} · ${c.signed_at} · IP ${c.signed_ip}`
              : "-"
          }
        />
        <Row
          k="날인본 업로드"
          v={
            c.uploaded_contract_key ? (
              <a
                className="text-blue-600 hover:underline"
                href={`/api/contracts/${c.id}/file/contract`}
                target="_blank"
                rel="noreferrer"
              >
                날인 계약서 보기
              </a>
            ) : (
              "-"
            )
          }
        />
        <Row
          k="인감증명서"
          v={
            c.uploaded_seal_cert_key ? (
              <a
                className="text-blue-600 hover:underline"
                href={`/api/contracts/${c.id}/file/cert`}
                target="_blank"
                rel="noreferrer"
              >
                인감증명서 보기
              </a>
            ) : (
              "-"
            )
          }
        />
        {c.status === "REJECTED" && <Row k="반려 사유" v={c.reject_reason} />}
        {c.status === "APPROVED" && <Row k="확정일" v={c.approved_at} />}
      </section>
    </div>
  );
}

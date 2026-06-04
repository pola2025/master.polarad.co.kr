import Link from "next/link";
import { listContracts, type ContractStatus } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_META: Record<ContractStatus, { label: string; cls: string }> = {
  DRAFT: { label: "작성", cls: "bg-gray-100 text-gray-700" },
  SENT: { label: "발송됨", cls: "bg-blue-100 text-blue-700" },
  SUBMITTED: { label: "체결접수", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "계약확정", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "반려", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소", cls: "bg-gray-100 text-gray-500" },
};

const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

export default async function ContractsPage() {
  const contracts = await listContracts();

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            전자계약
          </h1>
          <p className="text-sm text-gray-500">
            계약서 작성·발송·날인 업로드·확정 관리
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          + 새 계약
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">계약번호</th>
              <th className="px-4 py-3 text-left">광고주 / 대상사업</th>
              <th className="px-4 py-3 text-right">금액</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">수신확인</th>
              <th className="px-4 py-3 text-left">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {contracts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  계약이 없습니다. [+ 새 계약]으로 시작하세요.
                </td>
              </tr>
            )}
            {contracts.map((c) => {
              const m = STATUS_META[c.status] || STATUS_META.DRAFT;
              return (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {c.contract_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                    {c.party_a_name}
                    {c.project_name && (
                      <span className="text-gray-400"> · {c.project_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">
                    {won(c.total_fee)}
                    <span className="text-gray-400 text-xs">
                      {" "}
                      / {c.period_months}개월
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}
                    >
                      {m.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {c.opened_at ? (
                      <span className="text-green-600">📬 열람</span>
                    ) : c.status === "SENT" ? (
                      <span className="text-gray-400">미열람</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.created_at?.slice(0, 10)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

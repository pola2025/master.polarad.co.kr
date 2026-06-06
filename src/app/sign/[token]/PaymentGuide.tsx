interface PaymentInfo {
  bankName: string;
  account: string;
  holder: string;
  naverBooking: string;
}

const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

/** 결제 안내 — 서명 폼·제출완료·계약확정 화면 공용 (문서엔 미포함). */
export default function PaymentGuide({
  monthlyFee,
  periodMonths,
  totalFee,
  payment,
}: {
  monthlyFee: number;
  periodMonths: number;
  totalFee: number;
  payment: PaymentInfo;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-2">결제 안내</h2>
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm space-y-3">
        <p className="text-gray-700">
          계약 금액 <b className="text-gray-900">{won(totalFee)}</b>{" "}
          <span className="text-gray-500">
            (월 {won(monthlyFee)} × {periodMonths}개월 · 선결제 · VAT 포함)
          </span>
        </p>
        <div>
          <p className="font-medium text-gray-800">① 지정계좌이체</p>
          <p className="text-gray-700">
            {payment.bankName} {payment.account} ({payment.holder})
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-800">② 온라인결제 (네이버예약)</p>
          <a
            href={payment.naverBooking}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-1 px-4 py-2 rounded-lg bg-[#03c75a] text-white text-sm font-semibold"
          >
            네이버예약으로 결제하기
          </a>
          <p className="text-xs text-gray-500 mt-2">
            ※ 예약 날짜는 <b>오늘을 제외</b>한 날짜로 선택하시고, 계약 금액에
            맞는 옵션으로 결제를 진행해 주세요.
          </p>
        </div>
      </div>
    </section>
  );
}

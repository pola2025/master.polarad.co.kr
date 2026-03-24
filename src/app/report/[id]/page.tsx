"use client";

import { useState, use } from "react";
import { Loader2, Mail, Lock } from "lucide-react";

export default function ReportViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/report/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "인증에 실패했습니다.");
        return;
      }
      setReportHtml(data.html);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // 리포트 표시
  if (reportHtml) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[860px] mx-auto">
          <iframe
            srcDoc={reportHtml}
            className="w-full border-0"
            style={{ minHeight: "100vh" }}
            title="브랜드 분석 리포트"
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument) {
                iframe.style.height =
                  iframe.contentDocument.body.scrollHeight + "px";
              }
            }}
          />
        </div>
      </div>
    );
  }

  // 이메일 인증 화면
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="text-xs text-gray-400 tracking-widest mb-1">
              POLARAD
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              브랜드 검색 평가 리포트
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              리포트 열람을 위해 접수 시 등록한 이메일을 입력해주세요.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                이메일 주소
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              리포트 열람
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            접수 시 등록한 이메일만 인증 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

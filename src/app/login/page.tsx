"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Step = "initial" | "sent"

export default function LoginPage() {
  const [step, setStep] = useState<Step>("initial")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const router = useRouter()

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  async function handleSend() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "발송 중 오류가 발생했습니다.")
        return
      }
      setStep("sent")
      setCode("")
    } catch {
      setError("발송 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked) return
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "인증에 실패했습니다.")
        if (data.lockedUntil) setLockedUntil(data.lockedUntil)
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      setError("인증 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">폴라애드 관리자</CardTitle>
          <CardDescription>
            {step === "initial"
              ? "텔레그램으로 인증코드를 받아 로그인합니다."
              : "텔레그램으로 발송된 6자리 코드를 입력하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "initial" ? (
            <Button onClick={handleSend} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                "텔레그램으로 인증코드 받기"
              )}
            </Button>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  disabled={isLocked}
                />
                <p className="text-xs text-muted-foreground text-center mt-1">유효시간 5분</p>
              </div>
              <Button
                type="submit"
                disabled={loading || code.length !== 6 || isLocked}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    확인 중...
                  </>
                ) : (
                  "확인"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSend}
                disabled={loading}
                className="w-full text-sm"
              >
                코드 재발송
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

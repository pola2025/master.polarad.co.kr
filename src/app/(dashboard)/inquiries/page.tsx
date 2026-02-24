"use client"

import { useState, useEffect } from "react"
import {
  MessageSquare,
  Search,
  Mail,
  Phone,
  Building,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Inquiry {
  id: string
  no: number
  name: string
  company: string
  email: string
  phone: string
  message: string
  createdAt: string
}

interface InquiryStats {
  total: number
  thisMonth: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [stats, setStats] = useState<InquiryStats>({ total: 0, thisMonth: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function fetchInquiries() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/inquiries")
      if (!res.ok) throw new Error("조회 실패")
      const data = await res.json()
      setInquiries(data.inquiries || [])
      setStats(data.stats || { total: 0, thisMonth: 0 })
    } catch {
      setError("문의 데이터를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInquiries()
  }, [])

  const filteredInquiries = inquiries.filter((inquiry) => {
    const q = searchQuery.toLowerCase()
    return (
      inquiry.name.toLowerCase().includes(q) ||
      inquiry.company.toLowerCase().includes(q) ||
      inquiry.email.toLowerCase().includes(q) ||
      inquiry.phone.includes(q) ||
      inquiry.message.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">문의 관리</h1>
          <p className="text-muted-foreground">폴라애드 홈페이지 접수 문의를 확인합니다.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInquiries} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 문의</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">누적 접수</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 문의</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">이번 달 접수</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 목록 + 상세 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름, 회사, 연락처, 문의내용 검색..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">
                    {searchQuery ? "검색 결과가 없습니다" : "문의가 없습니다"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    새로운 문의가 들어오면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>문의자</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>문의내용</TableHead>
                      <TableHead>날짜</TableHead>
                      <TableHead className="w-[30px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInquiries.map((inquiry) => (
                      <TableRow
                        key={inquiry.id}
                        className={`cursor-pointer ${selectedInquiry?.id === inquiry.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedInquiry(inquiry)}
                      >
                        <TableCell className="text-muted-foreground text-sm">{inquiry.no}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {inquiry.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{inquiry.name}</p>
                              {inquiry.company && (
                                <p className="text-xs text-muted-foreground">{inquiry.company}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inquiry.phone}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm line-clamp-1 max-w-[200px]">{inquiry.message}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDate(inquiry.createdAt)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 상세 패널 */}
        <div>
          {selectedInquiry ? (
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{selectedInquiry.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{selectedInquiry.name}</CardTitle>
                    {selectedInquiry.company && (
                      <CardDescription>{selectedInquiry.company}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {selectedInquiry.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${selectedInquiry.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {selectedInquiry.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedInquiry.phone}`} className="hover:underline">
                      {selectedInquiry.phone}
                    </a>
                  </div>
                  {selectedInquiry.company && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedInquiry.company}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground">문의 내용</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedInquiry.message}</p>
                </div>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  접수: {formatDate(selectedInquiry.createdAt)}
                </p>

                <div className="flex gap-2 pt-2">
                  {selectedInquiry.email && (
                    <Button className="flex-1" asChild>
                      <a href={`mailto:${selectedInquiry.email}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        이메일 답변
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <a href={`tel:${selectedInquiry.phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">문의를 선택하세요</h3>
                <p className="text-sm text-muted-foreground">
                  목록에서 문의를 클릭하면 상세 내용을 볼 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import {
  MessageSquare,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Building,
  Clock,
  CheckCircle,
  AlertCircle,
  Reply,
  Trash2,
  Star,
  StarOff,
  Filter,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

interface Inquiry {
  id: number
  name: string
  email: string
  phone: string
  company: string
  subject: string
  message: string
  status: "new" | "pending" | "replied"
  starred: boolean
  createdAt: string
  service: string
  repliedAt?: string
}

// 실제 데이터 연동 전까지 빈 배열
const inquiriesData: {
  inquiries: Inquiry[]
  stats: {
    total: number
    new: number
    pending: number
    replied: number
    thisMonth: number
  }
} = {
  inquiries: [],
  stats: {
    total: 0,
    new: 0,
    pending: 0,
    replied: 0,
    thisMonth: 0,
  },
}

const statusConfig = {
  new: { label: "새 문의", icon: AlertCircle, variant: "destructive" as const, color: "text-red-600" },
  pending: { label: "처리 중", icon: Clock, variant: "secondary" as const, color: "text-yellow-600" },
  replied: { label: "답변 완료", icon: CheckCircle, variant: "default" as const, color: "text-green-600" },
}

export default function InquiriesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  const filteredInquiries = inquiriesData.inquiries.filter((inquiry) => {
    const matchesSearch =
      inquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.subject.toLowerCase().includes(searchQuery.toLowerCase())

    if (activeTab === "all") return matchesSearch
    if (activeTab === "new") return matchesSearch && inquiry.status === "new"
    if (activeTab === "pending") return matchesSearch && inquiry.status === "pending"
    if (activeTab === "starred") return matchesSearch && inquiry.starred
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">문의 관리</h1>
        <p className="text-muted-foreground">
          고객 문의를 확인하고 응답합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 문의</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inquiriesData.stats.total}</div>
            <p className="text-xs text-muted-foreground">이번 달 +{inquiriesData.stats.thisMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">새 문의</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inquiriesData.stats.new}</div>
            <p className="text-xs text-muted-foreground">답변 필요</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리 중</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inquiriesData.stats.pending}</div>
            <p className="text-xs text-muted-foreground">진행 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">답변 완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inquiriesData.stats.replied}</div>
            <p className="text-xs text-muted-foreground">처리 완료</p>
          </CardContent>
        </Card>
      </div>

      {/* 문의 목록 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 목록 */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="new">
                  새 문의
                  {inquiriesData.stats.new > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {inquiriesData.stats.new}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pending">처리 중</TabsTrigger>
                <TabsTrigger value="starred">중요</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="검색..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Tabs>

          <Card>
            <CardContent className="p-0">
              {filteredInquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">문의가 없습니다</h3>
                  <p className="text-sm text-muted-foreground">
                    새로운 문의가 들어오면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>문의자</TableHead>
                      <TableHead className="w-[300px]">제목</TableHead>
                      <TableHead>서비스</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>날짜</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInquiries.map((inquiry) => {
                      const status = statusConfig[inquiry.status]
                      return (
                        <TableRow
                          key={inquiry.id}
                          className={`cursor-pointer ${selectedInquiry?.id === inquiry.id ? "bg-muted" : ""}`}
                          onClick={() => setSelectedInquiry(inquiry)}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              {inquiry.starred ? (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ) : (
                                <StarOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TableCell>
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
                          <TableCell>
                            <p className="font-medium line-clamp-1">{inquiry.subject}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{inquiry.service}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <status.icon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {inquiry.createdAt.split(" ")[0]}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
                <div className="flex items-start justify-between">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Reply className="mr-2 h-4 w-4" />
                        답변하기
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Star className="mr-2 h-4 w-4" />
                        중요 표시
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 연락처 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedInquiry.email}`} className="text-blue-600 hover:underline">
                      {selectedInquiry.email}
                    </a>
                  </div>
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

                {/* 문의 내용 */}
                <div>
                  <h4 className="font-semibold mb-2">{selectedInquiry.subject}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedInquiry.message}
                  </p>
                </div>

                <Separator />

                {/* 메타 정보 */}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{selectedInquiry.service}</Badge>
                  <span>•</span>
                  <span>{selectedInquiry.createdAt}</span>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1">
                    <Reply className="mr-2 h-4 w-4" />
                    답변하기
                  </Button>
                  <Button variant="outline">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="outline">
                    <Phone className="h-4 w-4" />
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

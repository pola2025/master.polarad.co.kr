"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  ArrowUpDown,
  Loader2,
  Instagram,
  ExternalLink,
  RefreshCw,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ContentItem {
  id: string
  date: string
  title: string
  category: string
  content: string
  tags: string
  seoKeywords: string
  publishedAt: string
  status: string
  slug: string
  description: string
  thumbnailUrl: string
  views: number
  instagramPosted: boolean
}

interface ContentData {
  contents: ContentItem[]
  stats: {
    totalPosts: number
    publishedPosts: number
    draftPosts: number
    scheduledPosts: number
    totalViews: number
  }
  categories: { name: string; count: number }[]
}

const statusConfig = {
  published: { label: "발행됨", icon: CheckCircle, variant: "default" as const, color: "text-green-600" },
  draft: { label: "임시저장", icon: Clock, variant: "secondary" as const, color: "text-yellow-600" },
  scheduled: { label: "예약됨", icon: Clock, variant: "outline" as const, color: "text-blue-600" },
}

export default function ContentPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("posts")
  const [data, setData] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<ContentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    category: "",
    status: "",
    description: "",
    tags: "",
    seoKeywords: "",
    slug: "",
    thumbnailUrl: "",
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // 데이터 조회 함수
  const fetchContent = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      const response = await fetch("/api/content")
      if (!response.ok) {
        throw new Error("Failed to fetch content")
      }
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchContent()
  }, [fetchContent])

  // 삭제 확인 다이얼로그 열기
  const handleDeleteClick = (item: ContentItem) => {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/content?id=${deletingItem.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete content")
      }

      setNotification({
        type: "success",
        message: `"${deletingItem.title}" 콘텐츠가 삭제되었습니다.`,
      })

      // 3초 후 알림 제거
      setTimeout(() => setNotification(null), 3000)

      // 데이터 새로고침
      await fetchContent(true)
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "콘텐츠를 삭제할 수 없습니다.",
      })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setDeletingItem(null)
    }
  }

  // 새로고침
  const handleRefresh = () => {
    fetchContent(true)
  }

  // 수정 다이얼로그 열기
  const handleEditClick = (item: ContentItem) => {
    setEditingItem(item)
    setEditFormData({
      title: item.title,
      content: item.content,
      category: item.category,
      status: item.status,
      description: item.description,
      tags: item.tags,
      seoKeywords: item.seoKeywords,
      slug: item.slug,
      thumbnailUrl: item.thumbnailUrl,
    })
    setEditDialogOpen(true)
  }

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const data = await response.json()
      setEditFormData({ ...editFormData, thumbnailUrl: data.url })

      setNotification({
        type: "success",
        message: "이미지가 업로드되었습니다.",
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.",
      })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setIsUploading(false)
    }
  }

  // 수정 실행
  const handleEditSubmit = async () => {
    if (!editingItem) return

    setIsUpdating(true)
    try {
      const response = await fetch("/api/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingItem.id,
          ...editFormData,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update content")
      }

      setNotification({
        type: "success",
        message: `"${editFormData.title}" 콘텐츠가 수정되었습니다.`,
      })

      setTimeout(() => setNotification(null), 3000)

      // 다이얼로그 닫기 및 데이터 새로고침
      setEditDialogOpen(false)
      setEditingItem(null)
      await fetchContent(true)
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "콘텐츠를 수정할 수 없습니다.",
      })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredPosts = data?.contents.filter(
    (post) =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="font-semibold mb-2">데이터를 불러올 수 없습니다</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">콘텐츠 관리</h1>
          <p className="text-muted-foreground">
            블로그 포스트를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            새 포스트 작성
          </Button>
        </div>
      </div>

      {/* 알림 */}
      {notification && (
        <Alert
          variant={notification.type === "error" ? "destructive" : "default"}
          className={notification.type === "success" ? "border-green-200 bg-green-50 text-green-800" : ""}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 포스트</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.totalPosts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">발행됨</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.stats.publishedPosts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">임시저장</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data?.stats.draftPosts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예약됨</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data?.stats.scheduledPosts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 조회수</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.stats.totalViews || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 콘텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="posts">포스트</TabsTrigger>
            <TabsTrigger value="categories">카테고리</TabsTrigger>
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
            <Button variant="outline" size="icon">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 포스트 탭 */}
        <TabsContent value="posts">
          <Card>
            <CardContent className="p-0">
              {filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">포스트가 없습니다</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "검색 결과가 없습니다." : "새 포스트를 작성해보세요."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[400px]">제목</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead className="text-right">조회수</TableHead>
                      <TableHead>날짜</TableHead>
                      <TableHead className="w-[80px]">인스타</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map((post) => {
                      const status = statusConfig[post.status as keyof typeof statusConfig] || statusConfig.draft
                      return (
                        <TableRow key={post.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium line-clamp-1">{post.title}</p>
                              {post.slug && (
                                <p className="text-sm text-muted-foreground">/{post.slug}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <status.icon className={`h-3 w-3 ${status.color}`} />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {post.category && (
                              <Badge variant="outline">{post.category}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {post.views.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {post.date || post.publishedAt || "-"}
                          </TableCell>
                          <TableCell>
                            {post.instagramPosted ? (
                              <Instagram className="h-4 w-4 text-pink-500" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  미리보기
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  사이트에서 보기
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditClick(post)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  수정
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteClick(post)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 카테고리 탭 */}
        <TabsContent value="categories">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {data?.categories.map((category) => (
              <Card key={category.name} className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription>{category.count}개 포스트</CardDescription>
                </CardHeader>
              </Card>
            ))}
            {(!data?.categories || data.categories.length === 0) && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">카테고리가 없습니다</h3>
                  <p className="text-sm text-muted-foreground">
                    포스트를 작성하면 카테고리가 자동으로 생성됩니다.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>콘텐츠 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 &ldquo;{deletingItem?.title}&rdquo; 콘텐츠를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>콘텐츠 수정</DialogTitle>
            <DialogDescription>
              콘텐츠 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">제목</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, title: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-slug">슬러그 (URL)</Label>
              <Input
                id="edit-slug"
                value={editFormData.slug}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, slug: e.target.value })
                }
                placeholder="url-friendly-slug"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">카테고리</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, category: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">상태</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">임시저장</SelectItem>
                    <SelectItem value="published">발행됨</SelectItem>
                    <SelectItem value="scheduled">예약됨</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">설명</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, description: e.target.value })
                }
                placeholder="콘텐츠에 대한 간단한 설명"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-content">본문</Label>
              <Textarea
                id="edit-content"
                value={editFormData.content}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, content: e.target.value })
                }
                placeholder="콘텐츠 본문"
                rows={6}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-tags">태그</Label>
              <Input
                id="edit-tags"
                value={editFormData.tags}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, tags: e.target.value })
                }
                placeholder="태그1, 태그2, 태그3"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-seoKeywords">SEO 키워드</Label>
              <Input
                id="edit-seoKeywords"
                value={editFormData.seoKeywords}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, seoKeywords: e.target.value })
                }
                placeholder="검색 키워드1, 키워드2"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-thumbnailUrl">썸네일 이미지</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-thumbnailUrl"
                  value={editFormData.thumbnailUrl}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, thumbnailUrl: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
                <label htmlFor="image-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading}
                    asChild
                  >
                    <span>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "업로드"
                      )}
                    </span>
                  </Button>
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </div>
              {editFormData.thumbnailUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border bg-muted/50">
                  <img
                    src={editFormData.thumbnailUrl}
                    alt="썸네일 미리보기"
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isUpdating}
            >
              취소
            </Button>
            <Button onClick={handleEditSubmit} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

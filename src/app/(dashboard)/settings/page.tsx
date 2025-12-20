"use client"

import { useState } from "react"
import {
  Settings,
  Globe,
  Bell,
  Shield,
  Database,
  Mail,
  Palette,
  Key,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // 저장 로직 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">설정</h1>
          <p className="text-muted-foreground">
            대시보드와 사이트 설정을 관리합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          변경사항 저장
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4 hidden sm:block" />
            일반
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <Database className="h-4 w-4 hidden sm:block" />
            분석
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4 hidden sm:block" />
            알림
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4 hidden sm:block" />
            보안
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4 hidden sm:block" />
            테마
          </TabsTrigger>
        </TabsList>

        {/* 일반 설정 */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                사이트 정보
              </CardTitle>
              <CardDescription>기본 사이트 정보를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">사이트 이름</label>
                  <Input defaultValue="폴라애드" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">사이트 URL</label>
                  <Input defaultValue="https://polarad.co.kr" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">사이트 설명</label>
                <Input defaultValue="온라인영업 자동화 솔루션 | DB수집 & 리드제너레이션 전문" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">대표 이메일</label>
                  <Input defaultValue="contact@polarad.co.kr" type="email" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">대표 전화</label>
                  <Input defaultValue="02-1234-5678" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO 설정</CardTitle>
              <CardDescription>검색 엔진 최적화 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">메타 타이틀</label>
                <Input defaultValue="폴라애드 - 디지털 마케팅 전문 대행사" />
                <p className="text-xs text-muted-foreground">검색 결과에 표시되는 제목입니다. 60자 이내를 권장합니다.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">메타 설명</label>
                <Input defaultValue="온라인영업 자동화, DB수집, 리드제너레이션 전문. 네이버, 구글, SNS 마케팅 통합 솔루션을 제공합니다." />
                <p className="text-xs text-muted-foreground">검색 결과에 표시되는 설명입니다. 160자 이내를 권장합니다.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 분석 설정 */}
        <TabsContent value="analytics" className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              GA4 API가 연결되어 있습니다. 실제 데이터가 대시보드에 표시됩니다.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Google Analytics 4
              </CardTitle>
              <CardDescription>GA4 연동 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">연결됨</p>
                    <p className="text-sm text-muted-foreground">속성 ID: 123456789</p>
                  </div>
                </div>
                <Badge variant="default">활성</Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">GA4 Property ID</label>
                <Input defaultValue="123456789" placeholder="GA4 속성 ID" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">서비스 계정 이메일</label>
                <div className="flex gap-2">
                  <Input defaultValue="analytics@polarad-project.iam.gserviceaccount.com" readOnly />
                  <Button variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">서비스 계정 키 (JSON)</label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    defaultValue='{"type":"service_account"...}'
                    readOnly
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  보안을 위해 키는 마스킹 처리됩니다.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GA4 콘솔 열기
                </Button>
                <Button variant="outline">
                  연결 테스트
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google Search Console</CardTitle>
              <CardDescription>검색 콘솔 연동 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">연결됨</p>
                    <p className="text-sm text-muted-foreground">polarad.co.kr</p>
                  </div>
                </div>
                <Badge variant="default">활성</Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">사이트 URL</label>
                <Input defaultValue="https://polarad.co.kr" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 알림 설정 */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                이메일 알림
              </CardTitle>
              <CardDescription>이메일 알림 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "새 문의 알림", description: "새로운 문의가 접수되면 이메일로 알림을 받습니다.", enabled: true },
                { label: "주간 리포트", description: "매주 월요일 사이트 분석 리포트를 받습니다.", enabled: true },
                { label: "월간 리포트", description: "매월 1일 월간 분석 리포트를 받습니다.", enabled: false },
                { label: "트래픽 이상 감지", description: "비정상적인 트래픽이 감지되면 알림을 받습니다.", enabled: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant={item.enabled ? "default" : "secondary"}>
                    {item.enabled ? "활성" : "비활성"}
                  </Badge>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">알림 수신 이메일</label>
                <Input defaultValue="admin@polarad.co.kr" type="email" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>텔레그램 알림</CardTitle>
              <CardDescription>텔레그램 봇을 통한 실시간 알림을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">미연결</p>
                    <p className="text-sm text-muted-foreground">텔레그램 봇을 연결해주세요.</p>
                  </div>
                </div>
                <Badge variant="secondary">비활성</Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">봇 토큰</label>
                <Input placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" type="password" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">채팅 ID</label>
                <Input placeholder="-1001234567890" />
              </div>

              <Button variant="outline">연결 테스트</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 보안 설정 */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                비밀번호 변경
              </CardTitle>
              <CardDescription>관리자 비밀번호를 변경합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">현재 비밀번호</label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">새 비밀번호</label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">새 비밀번호 확인</label>
                <Input type="password" />
              </div>
              <Button>비밀번호 변경</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API 키 관리</CardTitle>
              <CardDescription>외부 서비스 연동을 위한 API 키를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "메인 API 키", key: "pk_live_****...****1234", created: "2024-12-01" },
                { name: "테스트 API 키", key: "pk_test_****...****5678", created: "2024-11-15" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm font-mono text-muted-foreground">{item.key}</p>
                    <p className="text-xs text-muted-foreground mt-1">생성일: {item.created}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline">새 API 키 생성</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>접근 로그</CardTitle>
              <CardDescription>최근 관리자 접근 기록입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { action: "로그인", ip: "192.168.1.1", time: "2024-12-20 14:30:00" },
                  { action: "설정 변경", ip: "192.168.1.1", time: "2024-12-20 14:25:00" },
                  { action: "로그인", ip: "192.168.1.1", time: "2024-12-19 10:15:00" },
                  { action: "콘텐츠 수정", ip: "192.168.1.1", time: "2024-12-19 10:20:00" },
                ].map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-sm text-muted-foreground">{log.ip}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{log.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 테마 설정 */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                테마 설정
              </CardTitle>
              <CardDescription>대시보드 외관을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">컬러 모드</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: "라이트", value: "light", active: true },
                    { name: "다크", value: "dark", active: false },
                    { name: "시스템", value: "system", active: false },
                  ].map((mode) => (
                    <div
                      key={mode.value}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        mode.active ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full mb-2 ${
                        mode.value === "light" ? "bg-white border" :
                        mode.value === "dark" ? "bg-gray-900" :
                        "bg-gradient-to-r from-white to-gray-900"
                      }`} />
                      <span className="text-sm font-medium">{mode.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">주요 색상</label>
                <div className="flex gap-2">
                  {["#2563eb", "#7c3aed", "#059669", "#dc2626", "#f59e0b"].map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">사이드바</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: "확장", value: "expanded", active: true },
                    { name: "축소", value: "collapsed", active: false },
                  ].map((mode) => (
                    <div
                      key={mode.value}
                      className={`flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        mode.active ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{mode.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

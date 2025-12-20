"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Megaphone,
  FileText,
  MessageSquare,
  Settings,
  ChevronUp,
  User2,
  Search,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const menuItems = [
  {
    title: "대시보드",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "방문 통계",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "방문 분석",
    url: "/analytics/insights",
    icon: TrendingUp,
  },
  {
    title: "캠페인 분석",
    url: "/analytics/campaigns",
    icon: Megaphone,
  },
  {
    title: "검색어 분석",
    url: "/analytics/keywords",
    icon: Search,
  },
  {
    title: "콘텐츠 관리",
    url: "/content",
    icon: FileText,
  },
  {
    title: "문의 관리",
    url: "/inquiries",
    icon: MessageSquare,
  },
  {
    title: "설정",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            P
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">폴라애드</span>
            <span className="text-xs text-muted-foreground">Admin Dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 className="h-4 w-4" />
                  <span>관리자</span>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem>
                  <span>프로필</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

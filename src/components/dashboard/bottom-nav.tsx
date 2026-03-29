"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Building2,
  Menu,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

const navItems = [
  { label: "홈", href: "/", icon: LayoutDashboard },
  { label: "통계", href: "/analytics", icon: BarChart3 },
  { label: "리드", href: "/inquiries", icon: MessageSquare },
  { label: "거래처", href: "/clients", icon: Building2 },
];

export function BottomNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t bg-background md:hidden">
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
        더보기
      </button>
    </nav>
  );
}

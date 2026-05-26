"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  Trophy,
  PlayCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  quizmasterOnly?: boolean;
};

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Play", url: "/dashboard/play", icon: PlayCircle },
  { title: "Quizzes", url: "/dashboard/quizzes", icon: FileText, quizmasterOnly: true },
  { title: "Teams", url: "/dashboard/teams", icon: Users, quizmasterOnly: true },
  { title: "Results", url: "/dashboard/results", icon: Trophy },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isQuizmaster =
    (session?.user as { role?: string } | undefined)?.role === "QUIZMASTER";
  const visibleItems = menuItems.filter(
    (item) => !item.quizmasterOnly || isQuizmaster
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-4 py-6">
          <h2 className="text-lg font-bold text-foreground">Friday Quiz</h2>
          <p className="text-sm text-muted-foreground">
            {isQuizmaster ? "Management Panel" : "Friday Quiz"}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={pathname === item.url || pathname?.startsWith(item.url + "/")}
              >
                <Link href={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-4 py-3 space-y-2">
          <div className="text-sm">
            <p className="font-medium">{session?.user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {(session?.user as any)?.role?.toLowerCase() || "Member"}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
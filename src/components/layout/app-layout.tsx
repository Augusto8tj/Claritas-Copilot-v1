"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  HelpCircle,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Sparkles,
  Target,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/icons";
import { UserNav } from "./user-nav";
import { useAuth } from "@/hooks/use-auth";


const navItems = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "Painel",
  },
  {
    href: "/analysis",
    icon: BarChart3,
    label: "Análise",
  },
  {
    href: "/goals",
    icon: Target,
    label: "Metas",
  },
  {
    href: "/chat",
    icon: MessageCircle,
    label: "Chat com IA",
  },
  {
    href: "/chat-insights",
    icon: Sparkles,
    label: "Chat com a Claritas",
  },
  {
    href: "/profile",
    icon: User,
    label: "Perfil",
    hidden: true,
  },
   {
    href: "/settings",
    icon: Settings,
    label: "Configurações",
    hidden: true,
  },
  {
    href: "/help",
    icon: HelpCircle,
    label: "Ajuda",
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [pageTitle, setPageTitle] = useState('Claritas Copilot');

  useEffect(() => {
    const currentNavItem = navItems.find(item => item.href === pathname);
    setPageTitle(currentNavItem?.label || 'Claritas Copilot');
  }, [pathname]);


  // Não renderiza o layout principal em telas de autenticação
  if (!user) {
    return <main>{children}</main>;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold font-headline text-primary">
              Claritas
            </h1>
          </div>
        </SidebarHeader>
        <SidebarMenu>
          {navItems.filter(item => !item.hidden).map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="justify-start"
              >
                <a href={item.href}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-sm border-b">
          <div className="flex items-center gap-4">
             <SidebarTrigger className="md:hidden" />
             <h2 className="text-lg font-semibold font-headline">
                {pageTitle}
             </h2>
          </div>
          <UserNav />
        </header>
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

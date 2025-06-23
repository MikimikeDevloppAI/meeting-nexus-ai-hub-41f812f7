
import React from "react";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarHeader
} from "@/components/ui/sidebar";
import { Calendar, MessageSquare, FileAudio, CheckSquare, FileText, Receipt, User, LogOut } from "lucide-react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Logo } from "@/components/Logo";

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const menuItems = [
    {
      title: "Assistant IA",
      url: "/assistant",
      icon: MessageSquare,
    },
    {
      title: "Réunions",
      url: "/meetings",
      icon: Calendar,
    },
    {
      title: "À faire",
      url: "/todos",
      icon: CheckSquare,
    },
    {
      title: "Documents",
      url: "/documents",
      icon: FileText,
    },
    {
      title: "Factures",
      url: "/invoices",
      icon: Receipt,
    },
    {
      title: "Profil",
      url: "/profile",
      icon: User,
    },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50 overflow-hidden">
        <Sidebar className="flex-shrink-0">
          <SidebarHeader className="px-4 lg:px-6 py-4 border-b">
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.url)}
                        className="flex items-center gap-3 w-full"
                      >
                        <item.icon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                        <span className="text-sm lg:text-base truncate">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => signOut()}
                      className="flex items-center gap-3 w-full text-red-500"
                    >
                      <LogOut className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                      <span className="text-sm lg:text-base truncate">Se déconnecter</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
          <header className="bg-white shadow-sm p-3 lg:p-4 flex justify-between items-center border-b flex-shrink-0">
            <div className="flex items-center min-w-0 flex-1">
              <SidebarTrigger className="flex-shrink-0" />
              <h2 className="ml-2 lg:ml-4 text-sm lg:text-lg font-medium truncate">
                OphtaCare Hub - Plateforme intelligente
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && (
                <div className="text-xs lg:text-sm font-medium truncate max-w-32 lg:max-w-none">
                  {user.email}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-3 lg:p-6 overflow-auto min-w-0">
            <div className="w-full max-w-full">
              <Outlet />
            </div>
          </main>
        </div>
        <Toaster />
        <Sonner />
      </div>
    </SidebarProvider>
  );
};

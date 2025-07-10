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
  SidebarHeader,
  useSidebar
} from "@/components/ui/sidebar";
import { Calendar, MessageSquare, FileAudio, CheckSquare, FileText, Receipt, User, LogOut, PenTool, Menu, Calculator } from "lucide-react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Logo } from "@/components/Logo";
import { useIsMobile } from "@/hooks/use-mobile";

const menuItems = [
  {
    title: "À faire",
    url: "/todos",
    icon: CheckSquare,
  },
  {
    title: "Réunions",
    url: "/meetings",
    icon: Calendar,
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FileText,
  },
  {
    title: "IOL Calculator",
    url: "/iol-calculator",
    icon: Calculator,
  },
  {
    title: "Lettres Patient",
    url: "/patient-letters",
    icon: PenTool,
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

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const handleNavigation = (url: string) => {
    navigate(url);
    // Fermer le menu sur mobile après navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r bg-white shadow-sm">
      <SidebarHeader className="px-4 lg:px-6 py-4 border-b bg-white">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-600 font-medium">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.url)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
                  >
                    <item.icon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                    <span className="text-sm lg:text-base truncate font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => signOut()}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200 mt-2"
                >
                  <LogOut className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                  <span className="text-sm lg:text-base truncate font-medium">Se déconnecter</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export const AppLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="bg-white shadow-sm p-3 lg:p-4 flex justify-between items-center border-b flex-shrink-0 relative z-50">
            <div className="flex items-center min-w-0 flex-1">
              <SidebarTrigger className="flex-shrink-0 hover:bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-2 px-3 py-2 rounded-md">
                <Menu className="h-4 w-4" />
                <span className="text-sm font-medium lg:hidden">Menu</span>
              </SidebarTrigger>
              <h2 className="ml-2 lg:ml-4 text-sm lg:text-lg font-medium truncate text-gray-800">
                OphtaCare Hub - Plateforme intelligente
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && (
                <div className="text-xs lg:text-sm font-medium truncate max-w-32 lg:max-w-none text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                  {user.email}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-3 lg:p-6 overflow-auto min-w-0 bg-gray-50">
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

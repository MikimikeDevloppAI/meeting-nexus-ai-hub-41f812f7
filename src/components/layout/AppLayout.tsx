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
  SidebarFooter,
  useSidebar
} from "@/components/ui/sidebar";
import { Calendar, MessageSquare, FileAudio, CheckSquare, FileText, Receipt, User, LogOut, PenTool, Menu, Calculator, Settings, Clock, UserCheck, Syringe, BarChart3, X } from "lucide-react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Logo } from "@/components/Logo";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { usePageHover } from "@/hooks/usePageHover";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TodoSidebarBadge } from "./TodoSidebarBadge";
import { HRValidationSidebarBadge } from "./HRValidationSidebarBadge";
import { HelpButton } from "./HelpButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const menuItems = [
  {
    title: "À faire",
    url: "/todos",
    icon: CheckSquare,
    permission: "todos",
  },
  {
    title: "Réunions",
    url: "/meetings",
    icon: Calendar,
    permission: "meetings",
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FileText,
    permission: "documents",
  },
  {
    title: "IOL Calculator",
    url: "/iol-calculator",
    icon: Calculator,
    permission: "iol-calculator",
  },
  {
    title: "Lettres Patient",
    url: "/patient-letters",
    icon: PenTool,
    permission: "patient-letters",
  },
  {
    title: "Factures",
    url: "/invoices",
    icon: Receipt,
    permission: "invoices",
  },
  {
    title: "Rétrocession",
    url: "/retrocession",
    icon: BarChart3,
    permission: "retrocession",
  },
  {
    title: "Injection",
    url: "/gestion-stock",
    icon: Syringe,
    permission: "stock-management",
  },
  {
    title: "Gestion du temps",
    url: "/time-tracking",
    icon: Clock,
    permission: "time-tracking",
  },
  {
    title: "Validation RH",
    url: "/hr-validation",
    icon: UserCheck,
    permission: "hr-validation",
  },
  {
    title: "Gestion Utilisateurs",
    url: "/users",
    icon: Settings,
    permission: "users",
    subItems: [
      {
        title: "Aide",
        url: "/users/help",
        permission: "users",
      }
    ]
  },
  {
    title: "Profil",
    url: "/profile",
    icon: User,
    permission: "profile",
  },
];

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { hasPermission, isAdmin, loading, permissions } = useUserPermissions();
  const { getHoverText } = usePageHover();
  const location = useLocation();

  const handleNavigation = (url: string) => {
    navigate(url);
    // Fermer le menu sur mobile après navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isActiveRoute = (url: string) => {
    return location.pathname === url;
  };

  return (
    <Sidebar className="bg-background border-r border-border">
      <SidebarHeader className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <CheckSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">OphtaCare Pro</h1>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {/* Menu items filtrés par permissions */}
              {menuItems
                .filter(item => {
                  const hasPerms = hasPermission(item.permission);
                  return !loading && hasPerms;
                })
                .map((item) => {
                  const hoverText = getHoverText(item.permission);
                  const isActive = isActiveRoute(item.url);
                  
                  const menuButton = (
                    <SidebarMenuButton
                      onClick={() => handleNavigation(item.url)}
                      className={`flex items-center gap-4 w-full px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        isActive 
                          ? "bg-primary text-primary-foreground font-medium shadow-sm" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-base font-medium">{item.title}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {/* Badge pour les tâches en cours */}
                        {item.permission === "todos" && <TodoSidebarBadge />}
                        {/* Badge pour les validations RH en attente */}
                        {item.permission === "hr-validation" && <HRValidationSidebarBadge />}
                      </div>
                    </SidebarMenuButton>
                  );

                  return (
                    <SidebarMenuItem key={item.title}>
                      {hoverText ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {menuButton}
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{hoverText}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        menuButton
                      )}
                    </SidebarMenuItem>
                  );
                })}
              
              {/* Badge todos toujours monté pour garantir la mise à jour en temps réel même pendant le chargement des permissions */}
              {loading && menuItems.find(item => item.permission === "todos") && (
                <SidebarMenuItem>
                  <SidebarMenuButton className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-muted-foreground">
                    <CheckSquare className="h-5 w-5 flex-shrink-0" />
                    <span className="text-base font-medium">À faire</span>
                    <div className="ml-auto">
                      <TodoSidebarBadge />
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
              <HelpButton />
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

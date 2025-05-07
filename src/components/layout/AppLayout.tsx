
import React, { ReactNode } from "react";
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
import { Calendar, MessageSquare, FileAudio, CheckSquare, Upload, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const menuItems = [
    {
      title: "Meetings",
      url: "/meetings",
      icon: Calendar,
    },
    {
      title: "To-dos",
      url: "/todos",
      icon: CheckSquare,
    },
    {
      title: "AI Assistant",
      url: "/assistant",
      icon: MessageSquare,
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: Upload,
    },
    {
      title: "User Profile",
      url: "/profile",
      icon: User,
    },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar>
          <SidebarHeader className="px-6 py-4 border-b">
            <h1 className="font-bold text-xl text-primary">NexusHub</h1>
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
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => signOut()}
                      className="flex items-center gap-3 w-full text-red-500"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Sign Out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="bg-white shadow-sm p-4 flex justify-between items-center">
            <div className="flex items-center">
              <SidebarTrigger />
              <h2 className="ml-4 text-lg font-medium">Internal Management System</h2>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <div className="text-sm font-medium">{user.email}</div>
              )}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
        <Toaster />
        <Sonner />
      </div>
    </SidebarProvider>
  );
};

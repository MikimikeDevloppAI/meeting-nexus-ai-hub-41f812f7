
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import NewMeeting from "./pages/NewMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import Meetings from "./pages/Meetings";
import Todos from "./pages/Todos";
import Assistant from "./pages/Assistant";
import Documents from "./pages/Documents";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import NotApproved from "./pages/NotApproved";
import NotFound from "./pages/NotFound";
import Invoices from "./pages/Invoices";
import UserManagement from "./pages/UserManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/not-approved" element={<NotApproved />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Index />} />
              <Route path="new-meeting" element={<NewMeeting />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="meetings/:id" element={<MeetingDetail />} />
              <Route path="todos" element={<Todos />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="documents" element={<Documents />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

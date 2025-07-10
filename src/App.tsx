
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import NewMeeting from "./pages/NewMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import Meetings from "./pages/Meetings";
import Todos from "./pages/Todos";
import Assistant from "./pages/Assistant";
import Documents from "./pages/Documents";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import NotApproved from "./pages/NotApproved";
import NotFound from "./pages/NotFound";
import Invoices from "./pages/Invoices";
import UserManagement from "./pages/UserManagement";
import PatientLetters from "./pages/PatientLetters";
import IOLCalculator from "./pages/IOLCalculator";

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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/not-approved" element={<NotApproved />} />
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Todos />} />
              <Route path="new-meeting" element={<NewMeeting />} />
              <Route path="meetings/new" element={<NewMeeting />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="meetings/:id" element={<MeetingDetail />} />
              <Route path="todos" element={<Todos />} />
              <Route path="documents" element={<Documents />} />
              <Route path="iol-calculator" element={<IOLCalculator />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="patient-letters" element={<PatientLetters />} />
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

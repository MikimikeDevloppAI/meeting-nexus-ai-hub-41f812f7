
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
import TimeTracking from "./pages/TimeTracking";
import HRValidation from "./pages/HRValidation";

import { PermissionProtectedRoute } from "./components/auth/PermissionProtectedRoute";
import { useTodoCounter } from "./hooks/useTodoCounter";

const queryClient = new QueryClient();

const App = () => {
  // Hook pour compter les tâches en cours et mettre à jour le titre
  useTodoCounter();

  return (
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
              <Route index element={
                <PermissionProtectedRoute requiredPermission="todos">
                  <Todos />
                </PermissionProtectedRoute>
              } />
              <Route path="new-meeting" element={
                <PermissionProtectedRoute requiredPermission="new-meeting">
                  <NewMeeting />
                </PermissionProtectedRoute>
              } />
              <Route path="meetings/new" element={
                <PermissionProtectedRoute requiredPermission="new-meeting">
                  <NewMeeting />
                </PermissionProtectedRoute>
              } />
              <Route path="meetings" element={
                <PermissionProtectedRoute requiredPermission="meetings">
                  <Meetings />
                </PermissionProtectedRoute>
              } />
              <Route path="meetings/:id" element={
                <PermissionProtectedRoute requiredPermission="meetings">
                  <MeetingDetail />
                </PermissionProtectedRoute>
              } />
              <Route path="todos" element={
                <PermissionProtectedRoute requiredPermission="todos">
                  <Todos />
                </PermissionProtectedRoute>
              } />
              <Route path="documents" element={
                <PermissionProtectedRoute requiredPermission="documents">
                  <Documents />
                </PermissionProtectedRoute>
              } />
              <Route path="iol-calculator" element={
                <PermissionProtectedRoute requiredPermission="iol-calculator">
                  <IOLCalculator />
                </PermissionProtectedRoute>
              } />
              <Route path="invoices" element={
                <PermissionProtectedRoute requiredPermission="invoices">
                  <Invoices />
                </PermissionProtectedRoute>
              } />
              <Route path="users" element={
                <PermissionProtectedRoute requiredPermission="users">
                  <UserManagement />
                </PermissionProtectedRoute>
              } />
              <Route path="patient-letters" element={
                <PermissionProtectedRoute requiredPermission="patient-letters">
                  <PatientLetters />
                </PermissionProtectedRoute>
              } />
              <Route path="time-tracking" element={
                <PermissionProtectedRoute requiredPermission="time-tracking">
                  <TimeTracking />
                </PermissionProtectedRoute>
              } />
              <Route path="hr-validation" element={
                <PermissionProtectedRoute requiredPermission="hr-validation">
                  <HRValidation />
                </PermissionProtectedRoute>
              } />
              <Route path="profile" element={
                <PermissionProtectedRoute requiredPermission="profile">
                  <Profile />
                </PermissionProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

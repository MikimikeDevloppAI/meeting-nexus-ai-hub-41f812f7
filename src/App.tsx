
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Meetings from "./pages/Meetings";
import NewMeeting from "./pages/NewMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import Todos from "./pages/Todos";
import Assistant from "./pages/Assistant";
import Invoices from "./pages/Invoices";
import Profile from "./pages/Profile";
import NotApproved from "./pages/NotApproved";
import NotFound from "./pages/NotFound";

// Layout
import { AppLayout } from "./components/layout/AppLayout";

const queryClient = new QueryClient();

// ProtectedRoute component that checks auth and approval status
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent">
        <div className="text-center">
          <div className="animate-pulse h-6 w-36 bg-primary/20 rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (!user.approved) {
    return <Navigate to="/not-approved" />;
  }
  
  return <>{children}</>;
};

// AuthLayout for wrapping authenticated pages with the app layout
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/not-approved" element={<NotApproved />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<Navigate to="/meetings" replace />} />
            <Route path="/meetings" element={<AuthLayout><Meetings /></AuthLayout>} />
            <Route path="/meetings/new" element={<AuthLayout><NewMeeting /></AuthLayout>} />
            <Route path="/meetings/:id" element={<AuthLayout><MeetingDetail /></AuthLayout>} />
            <Route path="/todos" element={<AuthLayout><Todos /></AuthLayout>} />
            <Route path="/assistant" element={<AuthLayout><Assistant /></AuthLayout>} />
            <Route path="/invoices" element={<AuthLayout><Invoices /></AuthLayout>} />
            <Route path="/profile" element={<AuthLayout><Profile /></AuthLayout>} />
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

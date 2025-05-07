
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if Supabase is configured
    if (isSupabaseConfigured()) {
      // Redirect to meetings page if Supabase is properly configured
      navigate("/meetings");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="text-center p-6 max-w-md">
        {isSupabaseConfigured() ? (
          <>
            <div className="animate-pulse h-6 w-36 bg-primary/20 rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading application...</p>
          </>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-red-200">
            <div className="flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Supabase Configuration Error</h2>
            <p className="text-gray-600 mb-4">
              The application cannot connect to Supabase because the required environment variables are missing.
            </p>
            <div className="bg-gray-100 p-4 rounded text-left text-sm font-mono mb-4">
              <p className="mb-1">VITE_SUPABASE_URL</p>
              <p>VITE_SUPABASE_ANON_KEY</p>
            </div>
            <p className="text-sm text-gray-500">
              Please set these environment variables or connect to Supabase using the Lovable Supabase integration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;

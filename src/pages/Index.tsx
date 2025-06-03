
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        console.log("Checking auth status on index page...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session check error:", error);
          return;
        }
        
        if (session?.user) {
          console.log("User authenticated, redirecting to assistant...");
          navigate("/assistant");
        } else {
          console.log("No authenticated user, redirecting to login...");
          navigate("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Fallback to login if auth check fails
        navigate("/login");
      }
    };

    checkAuthAndRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="text-center p-6 max-w-md">
        <div className="mb-6">
          <Logo className="justify-center" />
        </div>
        <div className="animate-pulse h-6 w-36 bg-primary/20 rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Chargement de l'application...</p>
      </div>
    </div>
  );
};

export default Index;

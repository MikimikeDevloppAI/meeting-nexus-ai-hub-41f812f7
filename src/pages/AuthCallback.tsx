
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse hash params from URL
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const error = hashParams.get("error");
  const errorDescription = hashParams.get("error_description");
  const errorCode = hashParams.get("error_code");

  const isEmailLinkExpired = error === "access_denied" && errorCode === "otp_expired";

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;

      toast({
        title: "Confirmation email sent",
        description: "Please check your inbox and follow the link to confirm your email",
      });
      
      // Redirect to login page after successful resend
      setTimeout(() => navigate("/login"), 2000);
    } catch (error: any) {
      console.error("Resend error:", error);
      toast({
        title: "Error sending confirmation email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up URL if there's an error
  useEffect(() => {
    if (error) {
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [error, location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">NexusHub</h1>
          <p className="text-muted-foreground">Internal Management System</p>
        </div>
        <Card className="animate-scale-in">
          <CardHeader>
            <CardTitle>Email Verification</CardTitle>
            <CardDescription>
              {isEmailLinkExpired 
                ? "Your verification link has expired" 
                : "There was an issue with your verification link"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-amber-50 text-amber-800 border-amber-300">
              <AlertDescription>
                <p>{errorDescription || "The verification link is invalid or has expired."}</p>
                <p className="mt-2">Please request a new verification link.</p>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Your email address
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              onClick={handleResendConfirmationEmail} 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/login")}
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AuthCallback;


import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setEmailNotConfirmed(false);

    try {
      console.log("Attempting to sign in with email:", email);
      
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        // Check specifically for "Email not confirmed" error
        if (error.message === "Email not confirmed") {
          setEmailNotConfirmed(true);
          throw error;
        }
        throw error;
      }

      if (data.user) {
        console.log("Sign in successful, user:", data.user.id);
        
        // Check if user is approved with retry logic
        let userProfile = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('approved')
              .eq('id', data.user.id)
              .single();

            if (profileError) {
              console.error(`Profile fetch attempt ${attempt + 1} failed:`, profileError);
              if (attempt === 2) throw profileError;
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }

            userProfile = profile;
            break;
          } catch (err) {
            if (attempt === 2) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!userProfile?.approved) {
          toast({
            title: "Account pending approval",
            description: "Your account is waiting for admin approval.",
            variant: "destructive",
          });
          // Don't sign out immediately, let the auth state handler manage this
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        
        // Use navigate instead of window.location for a better experience
        navigate("/assistant");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Error signing in",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    
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
      setEmailNotConfirmed(false);
    } catch (error: any) {
      console.error("Resend error:", error);
      toast({
        title: "Error sending confirmation email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    emailNotConfirmed,
    resendingEmail,
    handleSubmit,
    handleResendConfirmationEmail,
  };
};

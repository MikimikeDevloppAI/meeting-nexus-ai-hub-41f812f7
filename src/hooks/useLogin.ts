
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
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check specifically for "Email not confirmed" error
        if (error.message === "Email not confirmed") {
          setEmailNotConfirmed(true);
          throw error;
        }
        throw error;
      }

      // Check if user is approved
      if (data.user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('approved')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        // Check if we got any results and if the first user is approved
        if (!userProfile?.approved) {
          toast({
            title: "Account pending approval",
            description: "Your account is waiting for admin approval.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        
        // Force navigation using window.location for a complete reload
        // This ensures a clean state and proper redirection
        window.location.href = "/meetings";
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

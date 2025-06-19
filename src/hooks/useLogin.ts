
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
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        if (error.message === "Email not confirmed") {
          setEmailNotConfirmed(true);
        }
        throw error;
      }

      if (data.user) {
        console.log("Sign in successful, user:", data.user.id);
        
        toast({
          title: "Connexion réussie !",
          description: "Redirection vers l'assistant...",
        });
        
        // Naviguer vers l'assistant après connexion réussie
        navigate("/assistant");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast({
        title: "Email requis",
        description: "Veuillez entrer votre adresse email",
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
        title: "Email de confirmation envoyé",
        description: "Vérifiez votre boîte de réception et suivez le lien pour confirmer votre email",
      });
      setEmailNotConfirmed(false);
    } catch (error: any) {
      console.error("Resend error:", error);
      toast({
        title: "Erreur d'envoi de l'email de confirmation",
        description: error.message || "Veuillez réessayer",
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

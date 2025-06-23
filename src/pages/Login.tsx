
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LoginHeader } from "@/components/auth/LoginHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { EmailConfirmationAlert } from "@/components/auth/EmailConfirmationAlert";
import { useLogin } from "@/hooks/useLogin";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  // Supprimer la vérification automatique de session qui causait des redirections
  useEffect(() => {
    setInitialCheckDone(true);
  }, []);

  const {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    emailNotConfirmed,
    resendingEmail,
    handleSubmit,
    handleResendConfirmationEmail,
  } = useLogin();

  // Ne pas afficher la page tant que la vérification initiale n'est pas terminée
  if (!initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md">
        <LoginHeader />
        <Card className="animate-scale-in">
          {emailNotConfirmed && (
            <div className="px-6">
              <EmailConfirmationAlert
                resendingEmail={resendingEmail}
                onResendConfirmationEmail={handleResendConfirmationEmail}
              />
            </div>
          )}
          
          <CardContent className="pt-6">
            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              isLoading={isLoading}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

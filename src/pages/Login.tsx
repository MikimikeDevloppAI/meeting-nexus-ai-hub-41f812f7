
import { Card, CardContent } from "@/components/ui/card";
import { LoginHeader } from "@/components/auth/LoginHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { EmailConfirmationAlert } from "@/components/auth/EmailConfirmationAlert";
import { useLogin } from "@/hooks/useLogin";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const Login = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
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

  // Rediriger si l'utilisateur est déjà connecté
  useEffect(() => {
    if (user && !authLoading) {
      console.log("Utilisateur déjà connecté, redirection vers /todos");
      navigate("/todos", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Afficher un loader pendant la vérification d'authentification initiale
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Ne pas afficher la page si l'utilisateur est connecté
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md">
        <LoginHeader />
        <Card className="animate-scale-in shadow-md hover:shadow-lg transition-shadow">
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

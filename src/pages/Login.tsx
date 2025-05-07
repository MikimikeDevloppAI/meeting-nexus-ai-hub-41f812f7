
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LoginHeader } from "@/components/auth/LoginHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { EmailConfirmationAlert } from "@/components/auth/EmailConfirmationAlert";
import { useLogin } from "@/hooks/useLogin";

const Login = () => {
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

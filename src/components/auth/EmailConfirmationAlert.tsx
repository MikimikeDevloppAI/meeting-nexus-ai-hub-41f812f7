
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailConfirmationAlertProps {
  resendingEmail: boolean;
  onResendConfirmationEmail: () => void;
}

export const EmailConfirmationAlert = ({
  resendingEmail,
  onResendConfirmationEmail
}: EmailConfirmationAlertProps) => {
  return (
    <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-300">
      <AlertDescription className="flex flex-col gap-2">
        <p>Your email address has not been confirmed yet.</p>
        <Button 
          variant="outline" 
          className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={onResendConfirmationEmail}
          disabled={resendingEmail}
        >
          {resendingEmail ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Resend confirmation email"
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
